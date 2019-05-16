'use strict';

const express       = require('express');
const async         = require('async');

const common        = require('../components/common');
const configuration = require('../components/configuration');

let callback = common.callback;

const router = express.Router();

router.post('/configuration/create', function (req, res) {
    let sessionInfo = {};

    async.series([
        callback => {
            common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        },
        callback => {
            let request = {
                configType: req.body.configType,
                configName: req.body.configName,
                configDescription: req.body.configDescription,
                configValue: req.body.configValue,
                isConfigEditable: req.body.isConfigEditable,
                isConfigViewable: req.body.isConfigViewable,
                createdBy: sessionInfo['username']
            };

            configuration.createConfiguration(request, callback);
        }
    ], err => {
        if (err) {
            return callback(err, req, res);
        }

        return callback(null, req, res);
    });
});

router.post('/configuration/update', function (req, res) {
    let sessionInfo = {};

    common.verifySession(req.body.userId, req.body.sessionId, (err) => {
        let request = {
            configId: req.body.configId,
            configType: req.body.updatedFields.configType,
            configName: req.body.updatedFields.configName,
            configDescription: req.body.updatedFields.configDescription,
            configValue: req.body.updatedFields.configValue,
            isConfigEditable: req.body.updatedFields.isConfigEditable,
            isConfigViewable: req.body.updatedFields.isConfigViewable,
            updatedBy: sessionInfo['username']
        };

        configuration.updateConfiguration(request, (err) => {
            if (err) {
                return callback(err, req, res);
            }

            return callback(null, req, res);
        });
    }, sessionInfo, req.headers.referer);
});

router.post('/configuration/show', function (req, res) {
    let data = [];

    common.verifySession(req.body.userId, req.body.sessionId, (err) => {
        configuration.showConfiguration({configId: req.body.configId, configType: req.body.configType}, data, (err) => {
            if (err) {
                return callback(err, req, res);
            }

            return callback(null, req, res, data);
        });
    }, undefined, req.headers.referer);
});

module.exports = router;