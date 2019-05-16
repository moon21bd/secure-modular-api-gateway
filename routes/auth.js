'use strict';

const express       = require('express');
const jose          = require('node-jose');
const async         = require('async');
const uuidv1        = require('uuid/v1');
const base64url     = require('base64url');
const fs            = require('fs');

const validator     = require('../lib/validator');
const resGen        = require('../lib/result.codes');
const keystore      = require('../resources/client.keystore.js.example');
const credentials   = require('../resources/client.credentials.js.example');
const tokenhandler  = require('../lib/tokenhandler');

const router  = express.Router();

let clientKeystore;

jose.JWK.asKeyStore(keystore).then(result => {
    clientKeystore = result;
});

router.post('/token', tokenhandler.retrievePayload, validator, function(req, res) {
    let clientCredential;
    let data = {};

    const callback = function(err) {
        if (err) {
            res.json(resGen.finalizeResponse(err));
            return;
        }

        res.json(resGen.responseGenerator(resGen.SUCCESS, '', undefined, 200, [data]));
    };

    async.series([
        callback => {
            if (req.body.grantType !== 'client_credentials') {
                return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, 'Invalid grant type'));
            }

            callback();
        },
        callback => {
            clientCredential = credentials.check(req.body.clientId, req.body.clientSecret);
            if (!clientCredential) {
                return callback(resGen.responseGenerator(resGen.AUTH_TOKEN_ERR, 'Client credential mis-match'));
            }

            callback();
        },
        callback => {
            tokenhandler.generateAccessToken(clientCredential.signKeyId, data, callback);
        }
    ], err => {
       if (err) {
           return callback(err);
       }

       callback(null, data);
    });
});

router.post('/encrypt-payload', function(req, res) {
    let data = {};

    tokenhandler.encryptPayload(req.body.payload, req.body.keyId, data,
        function(err) {
            if (err) {
                res.json(resGen.finalizeResponse(err));
                return;
            }

            res.json(resGen.responseGenerator(resGen.SUCCESS, '', undefined, 200, [data]));
    });
});

router.post('/decrypt-payload', function(req, res) {
    tokenhandler.retrievePayload(req, res, (err) => {
        if (err) {
            res.json(err);
            return;
        }

        delete req.body.keyId;
        res.json(req.body);
    });
});

router.post('/generate-key', function(req, res) {
    let data = {};

    const callback = function(err) {
        if (err) {
            res.status(400);
            res.json({error: err});
            return;
        }

        res.status(200);
        res.json({keyId: data.keyId});
    };

    async.series([
        callback => {
            if (Object.keys(keystore).length === 0) {
                data.clientKeystore = jose.JWK.createKeyStore();
                return callback();
            }

            loadKeyStore(keystore, data, callback);
        },
        callback => {
            generateAndSaveKeyStore(data.clientKeystore, data, callback);
        }
    ], err => {
        if (err) {
            return callback(err);
        }

        callback();
    });
});

function loadKeyStore(input, data, callback) {
    jose.JWK.asKeyStore(input)
        .then(function(result) {
            data.clientKeystore = result;
            callback();
        });
}

function generateAndSaveKeyStore(clientKeystore, data, callback) {
    let props = {
        kid: uuidv1(),
        alg: 'A128CBC-HS256',
        use: 'enc'
    };

    data.keyId = props.kid;
    clientKeystore.generate("oct", 256, props)
        .then(function(result) {
            let content = 'module.exports = ' + JSON.stringify(clientKeystore.toJSON(true), null, 2) + ';';
            fs.writeFile("./resources/client.keystore.js", content, function(err) {
                if(err) {
                    return callback(err);
                }

                callback();
            });
        });
}

module.exports = router;
