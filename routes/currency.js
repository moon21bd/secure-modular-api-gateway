'use strict';

const express    = require('express');
const async      = require('async');

const common     = require('../components/common');
const currency   = require('../components/currency');

const router = express.Router();

let callback = common.callback;

router.post('/currency/create', function (req, res) {
    let sessionInfo = {};
    let request = {
        currencyName: req.body.currencyName,
        currencyDescription: req.body.currencyDescription,
        currencyConversionRate: req.body.currencyConversionRate,
        countryName: req.body.countryName,
        countryCode: req.body.countryCode,
        isoAlpha2Code: req.body.isoAlpha2Code,
    };

    async.series([
        callback => {
            common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        },
        callback => {
            request.createdBy = sessionInfo['username'];
            currency.createCurrency(request, callback);
        }
    ], err => {
        if (err) {
            return callback(err, req, res);
        }

        return callback(null, req, res);
    });
});

router.post('/currency/update', function (req, res) {
    let sessionInfo = {};
    let request = {
        currencyName: req.body.updatedFields.currencyName,
        currencyDescription: req.body.updatedFields.currencyDescription,
        status: req.body.updatedFields.status,
        currencyConversionRate: req.body.updatedFields.currencyConversionRate,
        countryName: req.body.updatedFields.countryName,
        countryCode: req.body.updatedFields.countryCode,
        isoAlpha2Code: req.body.updatedFields.isoAlpha2Code,
        currencyId: req.body.currencyId
    };

    async.series([
        callback => {
            common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        },
        callback => {
            request.updatedBy = sessionInfo['username'];
            currency.updateCurrency(request, callback);
        }
    ], err => {
        if (err) {
            return callback(err, req, res);
        }

        return callback(null, req, res);
    });
});

router.post('/currency/show', function(req, res) {
    let data = [];

    async.series([
        callback => {
            common.verifySession(req.body.userId, req.body.sessionId, callback, undefined, req.headers.referer);
        },
        callback => {
            let filters = {
                currencyId: req.body.currencyId
            };
            currency.retrieveCurrencyList(filters, data, callback);
        }
    ], err => {
        if (err) {
            return callback(err, req, res);
        }

        callback(null, req, res, data, true);
    });
});

router.post([ '/currency/list', '/currency-list' ], function(req, res) {
    let data = [];

    async.series([
        callback => {
            currency.retrieveCurrencyList({}, data, callback);
        }
    ], err => {
        if (err) {
            return callback(err, req, res);
        }

        callback(null, req, res, data, true);
    });
});

module.exports = router;

