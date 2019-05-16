'use strict';

const async         = require('async');
const jose          = require('node-jose');
const base64url     = require('base64url');
const randomstring  = require('randomstring');

const resGen        = require('../lib/result.codes');
const keystore      = require('../resources/client.keystore.js.example');
const checklist    = require('../resources/checklist');
const cfg           = require('../config');

let clientKeystore;

jose.JWK.asKeyStore(keystore).then(result => {
    clientKeystore = result;
});

function getKeyId(serializedJWE) {
    let kid = undefined;

    try {
        kid = JSON.parse(base64url.decode(serializedJWE.split('.')[0])).kid;
    } catch(e) {}

    return kid;
}

function getAccessToken(req, authInfo, callback) {
    let auth = req.headers['authorization'];
    if (auth && auth.toLowerCase().indexOf('bearer') === 0) {
        authInfo.accessToken = auth.slice('bearer '.length);
        return callback();
    }
    return callback(resGen.responseGenerator(resGen.AUTH_TOKEN_ERR, 'Access token allow only in Authorization header'));
}

function getClaims(serializedJWS, key, claims, callback) {
    jose.JWS.createVerify(key)
        .verify(serializedJWS)
        .then(result => {
            try {
                let payload = JSON.parse(result.payload.toString());
                Object.keys(payload).forEach((key) => claims[key] = payload[key]);
                callback();
            } catch(e) {
                callback(resGen.responseGenerator(resGen.AUTH_TOKEN_ERR, 'Claim set is not JSON formatted'));
            }
        })
        .catch(err => {
            callback(resGen.responseGenerator(resGen.AUTH_TOKEN_ERR, err.toString()));
        });
}

function verifyClaims(claims) {
    let now = Math.floor(Date.now() / 1000);
    return claims.iat <= now && claims.exp >= now;
    // return claims.iss === cfg.domain && claims.iat <= now && claims.exp >= now;
}

const getKey = function(serializedJWE, keyInfo, callback) {
    let keyId = getKeyId(serializedJWE);
    if (!keyId) return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, 'No kid found'));

    let key = clientKeystore.get(keyId);
    if (!key) return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, 'No key found'));

    keyInfo.key = key;
    callback();
};

const encryptPayload = function(payload, keyId, container, callback) {
    let key = clientKeystore.get(keyId);
    if (!key) return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, 'No key found'));

    jose.JWE.createEncrypt({ format: 'compact', zip: true }, key)
        .update(Buffer.from(JSON.stringify(payload), 'utf8'))
        .final()
        .then(result => {
            try {
                container.payload = result;
                return callback();
            } catch (e) {
                return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, 'Payload is not JSON formatted'));
            }
        }).catch(err => {
            return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, err.toString()));
        });
};

const decryptPayload = function(serializedJWE, key, payload, callback) {
    jose.JWE.createDecrypt(key)
        .decrypt(serializedJWE)
        .then(result => {
            try {
                let parsed = JSON.parse(result.payload.toString('utf8'));
                Object.keys(parsed).forEach((key) => payload[key] = parsed[key]);
                callback();
            } catch (e) {
                callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, 'Payload is not JSON formatted'));
            }
        }).catch(err => {
        callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, err.toString()));
    });
};

const generateAccessToken = function(keyId, response, callback) {
    let key = clientKeystore.get(keyId);

    let claims = {
        iss: cfg.domain,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + cfg.ttl.accesstoken,
        jti: randomstring.generate(8)
    };

    jose.JWS.createSign({ format: 'compact', fields: { typ: 'jose', cty: 'jwk+json' } }, key)
        .update(JSON.stringify(claims))
        .final()
        .then(result => {
            response.access_token = result;
            response.token_type = 'Bearer';
            response.expires_in = cfg.ttl.accesstoken;

            callback();
        })
        .catch(err => {
            callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
        });
};

const retrievePayload = function (req, res, next) {
    if (cfg.env === 'development') {
        next();
        return;
    }

    if (!checklist.checkDecryption(req.originalUrl)) {
        next();
        return;
    }

    let keyInfo = {};

    const callback = function(err) {
        if (err && req.originalUrl.startsWith('/api/redeem-card')) {
            return res.json({
                status: err.status,
                error: err.details
            });
        }

        if (err && [
            '/api/bd-order-api',
            '/api/bd-order-api-status',
            '/api/platform-get-balance',
            '/api/country-b-order-api',
            '/api/country-b-order-api-status',
            '/api/top-up/check',
            '/api/top-up/request',
            '/api/top-up/status',
            '/api/datapack/list',
            '/api/datapack/check',
            '/api/datapack/request',
            '/api/datapack/status'
        ].some((thirdPartyUrl) => req.originalUrl.startsWith(thirdPartyUrl))) {
            return res.json({ status: err.status, error: err.details });
        }

        if (err) {
            return res.json(resGen.finalizeResponse(err));
        }

        next();
    };
    console.log(req.query.payload);
    if (! req.body.payload && req.query.payload) {

        req.body.payload = req.query.payload;
    }

    async.series([
        callback => {
            getKey(req.body.payload, keyInfo, callback);
        },
        callback => {
            let payload = req.body.payload;
            delete req.body.payload;
            req.keyInfo = keyInfo; // For future payload encryption.
            decryptPayload(payload, keyInfo.key, req.body, callback);
        }
    ], err => {
        if (err) {
            return callback(err);
        }

        callback();
    });
};

const verifyAccessToken = function(req, res, next) {
    if (cfg.env === 'development') {
        next();
        return;
    }

    if (!checklist.checkAuthorization(req.originalUrl)) {
        next();
        return;
    }

    let authInfo = {};
    let keyInfo = {};
    let claims = {};

    const callback = function(err) {
        if (err) {
            return res.json(resGen.finalizeResponse(err));
        }

        next();
    };

    async.series([
        callback => {
            getAccessToken(req, authInfo, callback);
        },
        callback => {
            getKey(authInfo.accessToken, keyInfo, callback);
        },
        callback => {
            getClaims(authInfo.accessToken, keyInfo.key, claims, callback);
        },
        callback => {
            let valid = verifyClaims(claims);
            if (!valid) return callback(resGen.responseGenerator(resGen.SESSION_EXPIRED_ERR, 'Claim set do not match'));

            callback();
        }
    ], err => {
        if(err) {
            return callback(err);
        }

        callback();
    });
};

module.exports = {
    encryptPayload: encryptPayload,
    retrievePayload: retrievePayload,
    generateAccessToken: generateAccessToken,
    verifyAccessToken: verifyAccessToken
};