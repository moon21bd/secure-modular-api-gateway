'use strict';

const express     = require('express');
const async       = require('async');

const common      = require('../components/common');
const currency    = require('../components/currency');
const lot         = require('../components/lot');
const product     = require('../components/product');
const promo       = require('../components/promo');

const router = express.Router();

let callback = common.callback;

router.post('/promo/create', function(req, res) {
    let sessionInfo = {};
    let container = {};

    async.series([
        callback => {
            common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        },
        callback => {
            promo.createPromoInfo({
                type: req.body.type,
                text: req.body.text,
                maskingText: req.body.maskingText,
                startTime: req.body.startTime,
                endTime: req.body.endTime,
                username: sessionInfo['username']
            }, container, callback);
        }
    ], err => {
        if (err) {
            return callback(err, req, res);
        }

        callback(null, req, res);
    })
});

router.post('/promo/update', function(req, res) {
    let sessionInfo = {};

    async.series([
        callback => {
            common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        },
        callback => {
            promo.updatePromoInfo({
                promoId: req.body.promoId,
                type: req.body.type,
                text: req.body.text,
                maskingText: req.body.maskingText,
                startTime: req.body.startTime,
                endTime: req.body.endTime,
                username: sessionInfo['username']
            }, callback)
        }
    ], err => {
        if (err) {
            return callback(err, req, res);
        }

        callback(null, req, res);
    })
});

router.post('/promo/show', function(req, res) {
    let data = [];
    let sessionInfo = {};

    async.series([
        callback => {
            common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        },
        callback => {
            promo.showPromoInfo(req.body.promoId, data, callback);
        }
    ], err => {
        if (err) {
            return callback(err, req, res);
        }

        callback(null, req, res, data);
    })
});

module.exports = router;