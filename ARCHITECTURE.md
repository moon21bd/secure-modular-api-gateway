# Architecture

## Component diagram

```
                              Client (mobile / partner)
                                       │  POST { payload: <JWE blob> }
                                       ▼
                                    app.js
   ┌───────────────────────────────────────────────────────────────────┐
   │  cors → disable x-powered-by                                      │
   │  bank-receipt + upload routes  (BEFORE bodyParser.text — multer)  │
   │  bodyParser.text({type:"*/*"}) → raw, not JSON                    │
   │  JSON.parse attempt (query-only requests still valid)             │
   │  responseInterceptor (adds unread notification count)             │
   │  activityLog on login endpoints (logs failures too)               │
   └───────────────────────────────┬───────────────────────────────────┘
                                   ▼
                       /api  ── ipFilter
                             ── tokenhandler.verifyAccessToken   (JWS)
                             ── tokenhandler.retrievePayload     (JWE decrypt)
                             ── validator                        (Joi schemas)
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        ▼                          ▼                          ▼
  components/user/          components/wallet/         components/order/
  index.js + queries.js     index.js + queries.js      index.js + queries.js
        │                          │                          │
        └──────────────┬───────────┴──────────────────────────┘
                       ▼
        lib/common.db.operations.js  →  resources/database.connection.js
                       │
        lib/dbErrorHandler.js  (MySQL code → safe message)
                       ▼
        lib/result.codes.js + result.details.js  → one response envelope

  cross-cutting:
    lib/role.permission.js   resource + action bitmask + per-attribute context
    lib/activitylogMiddleware.js → components/common/activitylog
    lib/event.emitter.js     self-rescheduling background sweeps
    resources/*.database.connection.js   separate pools per workload
```

## Why it's shaped this way

**Payloads are encrypted, so parsing order is the security model.** Clients do
not send JSON — they send a JWE blob. The body is therefore read as raw text
(`bodyParser.text({ type: "*/*" })`), and only after `verifyAccessToken` and
`retrievePayload` have run is there a real object to validate. That is why the
`/api` chain is `ipFilter → verifyAccessToken → retrievePayload → validator`
and why reordering it is not a refactor: validation before decryption would
validate ciphertext, and decryption before token verification would do
cryptographic work for unauthenticated callers.

**Per-client keys, selected by `kid`.** `getKeyId()` reads the key id from the
JWE header and looks that key up in the keystore. Each API client gets its own
key pair, so a leaked client key compromises exactly one client's traffic
rather than the whole surface. The keystore itself is never committed.

**One route is registered before the body parser, deliberately.** File uploads
are `multipart/form-data`, and `bodyParser.text({ type: "*/*" })` consumes the
stream before multer can read it — every upload fails with a Bad Request and
nothing in the error points at the cause. Registering that route earlier is the
fix, and the comment survives in `app.js` because the next person to "tidy up"
the middleware order needs to know.

**Components own their SQL.** Each domain is `index.js` (logic) plus
`queries.js` (SQL), with no shared query file. A domain can be read, reviewed,
or deleted on its own; the alternative — one central query module — is how
unrelated domains end up coupled through a query someone edited for a different
reason.

**Notification counts are intercepted, not injected.** The client already polls
balance and profile endpoints. Rather than adding a notification lookup to
those components (and to every future one), `express-interceptor` appends the
count on the way out. Components stay unaware; enabling it elsewhere is one
array entry.

**Permissions are attribute-level, not just role-level.**
`checkRolePermission(rolePermissions, { resource, actionType, attributes })`
takes a bitmask (`SELECT=1, INSERT=2, UPDATE=4, DELETE=8`) so a role can hold
`SELECT|UPDATE` without `DELETE` as one value, plus optional `context` rules
per attribute for "can update this record, but not its `status` field" — a case
that otherwise forces you to invent a second resource.

**Database errors are normalised, never passed through.**
`lib/dbErrorHandler.js` maps ~40 MySQL driver codes to plain messages. The list
is long because it grew from production incidents rather than from
documentation — a raw `ER_DUP_ENTRY` reaching a client leaks schema detail and
means nothing to them.

**Separate pools per workload.** Activity logging, in-app notifications and
sales reporting each get their own connection resource. A long reporting query
saturating a shared pool would otherwise stall the transactional path, which is
the one that must never be slow.

## Request lifecycle

```
POST /api/user/balance-check     Authorization: Bearer <JWS>
Body: <JWE compact serialization>
  ▼
ipFilter                       source allowed?           no → reject
  ▼
tokenhandler.verifyAccessToken
  │  getAccessToken()          bearer header only
  │  getKey()                  kid from token header → keystore
  │  getClaims()               JWS verify
  │  verifyClaims()            iat <= now <= exp
  ▼
tokenhandler.retrievePayload
  │  getKey()                  kid from JWE header
  │  decryptPayload()          JWE → req.body
  ▼
validator                      Joi schema for this route
  ▼
components/user/index.js
  │  role.permission check
  │  queries.js via common.db.operations
  │  DB error? → dbErrorHandler.normalize()
  ▼
result.details / result.codes  → uniform envelope { code, message, data }
  ▼
responseInterceptor            appends unread notification count
```

## Adding a domain

```
1. components/<name>/queries.js    SQL for this domain only
2. components/<name>/index.js      logic; emits events if others should react
3. lib/schemas/<name>.schema.js    request validation
4. routes/<name>.js                route definitions
5. app.js                          add the router to the /api chain
```

Nothing outside those files changes. The middleware chain, permission checks,
error normalisation and response envelope all apply automatically because they
are mounted once, above every component.

## Structure walkthrough

`app.js` is the file to read first — it is the entire request contract in one
place. `lib/` is everything cross-cutting and domain-agnostic; none of those
files know what a "wallet" or an "order" is. `components/` is where domains
live, all structurally identical. `resources/` holds outbound connections and
credentials-adjacent config, deliberately separate from `config/` (which is
plain settings) so it is obvious which files must never be committed with real
values.
