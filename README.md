# Modular Domain Composer

A Node/Express API gateway built as a **modular monolith**: every business
domain lives in its own self-contained component (`index.js` + `queries.js`),
mounted behind one shared middleware chain that handles IP filtering, JWE
payload decryption, JWS token verification, schema validation and activity
logging — so no component reimplements any of it.

This is a **generalised reference implementation** of a production system. The
real folder structure, middleware ordering, encryption/token flow, permission
model and component conventions are preserved; employer, partner and product
names are replaced with neutral ones, private keys and database dumps are not
included, and every credential is read from the environment.

The original carries ~30 business components. The ones kept here are the ones
whose names are generic enough to be meaningful on their own (`user`, `role`,
`wallet`, `product`, `order`, `currency`, `lot`, `promo`, `complain`,
`fund_transfer`, `reports`, …); the rest were partner- or brand-specific and
are structurally identical to these.

## What it demonstrates

- **Encrypted request payloads, not plain JSON** — clients POST a JWE blob.
  `lib/tokenhandler.js` reads the `kid` from the JWE header, selects that
  client's key from the keystore, and decrypts the body *before* validation
  runs. Each API client has its own key, so one compromised client key never
  exposes another client's traffic.
- **Middleware order as a contract** — `ipFilter → verifyAccessToken →
  retrievePayload → validator` on the whole `/api` surface. Each stage assumes
  the previous one ran; that ordering is the security model, not a detail.
- **A documented ordering hazard** — the file-upload route is registered
  *before* `bodyParser.text({ type: "*/*" })`, because otherwise multer never
  sees the raw multipart stream and every upload fails. The comment explaining
  it is kept, since the failure mode is non-obvious.
- **Response interception for cross-cutting data** — unread in-app notification
  counts are appended to responses for endpoints the client already polls, via
  `express-interceptor`. No component knows notifications exist, and enabling
  it for another endpoint is one entry in a list.
- **Attribute-level RBAC** — `lib/role.permission.js` checks a role against a
  resource plus a bitmask action (`SELECT|INSERT|UPDATE|DELETE`), with optional
  per-attribute `context` rules for "may update this record but not this
  field". The full matrix is data in one place.
- **Broad DB error normalisation** — `lib/dbErrorHandler.js` maps ~40 real
  MySQL driver error codes to safe user-facing messages, so a driver error
  never reaches a client verbatim.
- **Audit logging via events, not calls** — `lib/activitylogMiddleware.js`
  records the request and hands the log id downstream on `req.body.logId`, so
  a component can attach detail to an audit entry without depending on the
  audit component.
- **Self-rescheduling background work** — `lib/event.emitter.js` polls by
  waiting for each run to *finish* before scheduling the next, so a slow sweep
  can never overlap itself the way a fixed `setInterval` would.
- **Per-domain connection pools** — `resources/*.database.connection.js` keeps
  activity logs, in-app notifications and sales reporting on separate
  connections, so a heavy reporting query cannot exhaust the pool the
  transactional path needs.

## Structure

```
app.js                       middleware chain + route mounting (read this first)
bin/www                      server bootstrap
components/<domain>/         index.js (logic) + queries.js (SQL) per domain
  common/activitylog/        shared audit-log service
routes/<domain>.js           thin route definitions
lib/
  tokenhandler.js            JWE decrypt / JWS access tokens (node-jose)
  validator.js               request schema validation
  role.permission.js         attribute-level RBAC
  menu.permission.js         menu visibility by role
  dbErrorHandler.js          MySQL error -> safe message
  result.codes.js result.details.js   response envelope + localised messages
  activitylogMiddleware.js   audit trail
  event.emitter.js           self-rescheduling poller
  ip.filter.js               source restriction
  phonenumber.js genericphonenumber.js   MSISDN normalisation
  common.db.operations.js utils.js
  schemas/                   per-domain Joi schemas
resources/
  *.database.connection.js   per-domain pools
  client.keystore.js.example client.credentials.js.example  (real files never committed)
  executionengine.*          external execution-engine bridge
  sms.properties.js email.properties.js
config/                      defaults + per-environment examples
tests/routes/                route tests
```

## Running

```bash
cp config/config.development.js.example config/config.development.js
cp resources/client.keystore.js.example resources/client.keystore.js   # then generate real keys
npm install
npm start
```

Ships without `node_modules/`, without any keystore or database dump, and with
every credential read from the environment.
