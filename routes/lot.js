'use strict';

const express = require('express');
const async = require('async');

const common = require('../components/common');
const currency = require('../components/currency');
const lot = require('../components/lot');
const product = require('../components/product');
const util = require('../lib/utils');

const router = express.Router();

let callback = common.callback;

router.post('/lot/create', function (req, res) {
    let data = [];
    let sessionInfo = {};
    let lotProductInfo;

    async.series([
        callback => {
            common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        },
        callback => {
            currency.verifyCurrencyId(req.body.currencyId, callback);
        },
        callback => {
            lotProductInfo = lot.mergeLotProductInfo(
                util.generateLotNumber(),
                req.body.productId,
                req.body.packageId,
                sessionInfo['username'],
                req.body.addOns
            );
            callback();
        },
        callback => {
            product.verifyMultipleProductIds(lotProductInfo.products, callback);
        },
        callback => {
            product.verifyMultiplePackageIds(lotProductInfo.packages, callback);
        },
        callback => {
            let lotInfo = {
                lotId: lotProductInfo.lotId,
                lotName: req.body.lotName,
                productId: req.body.productId,
                packageId: req.body.packageId,
                noOfCards: req.body.noOfCards,
                cardValue: req.body.cardValue,
                salesValue: req.body.salesValue,
                currencyId: req.body.currencyId,
                validationPeriod: req.body.validationPeriod,
                activeValueType: req.body.activeValueType || 0,
                addOns: {
                    add: lotProductInfo.add,
                    del: lotProductInfo.del
                },
                createdBy: sessionInfo['username']
            };

            lot.createLotInfo(lotInfo, callback);
        },
        callback => {
            lot.fetchLotInfo({lotId: lotProductInfo.lotId}, data, callback);
        }
    ], err => {
        if (err) {
            return callback(err, req, res, data);
        }

        callback(null, req, res, data);
    })
});

router.post('/lot/update', function (req, res) {
    let data = [];
    let sessionInfo = {};
    let lotInfo = {};
    let lotProductInfo;
    let updatedLotInfo = {};

    async.series([
        callback => {
            common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        },
        callback => {
            lot.verifyLotId(req.body.lotId, callback, lotInfo);
        },
        callback => {
            lot.verifyIfLotUpdatePermissible(lotInfo, req.body, callback);
        },
        callback => {
            if (lotInfo.lotStatus !== 1) return callback();
            lot.checkIfLotProvisionHappening(req.body.lotId, callback);
        },
        callback => {
            if (/* lotInfo.lotStatus === 1 || */!req.body.currencyId) return callback();
            currency.verifyCurrencyId(req.body.currencyId, callback);
        },
        callback => {
            /* if (lotInfo.lotStatus === 1) return callback(); */

            lotProductInfo = lot.mergeLotProductInfo(
                req.body.lotId,
                req.body.productId,
                req.body.packageId,
                sessionInfo['username'],
                req.body.addOns
            );
            product.verifyMultipleProductIds(lotProductInfo.products, callback);
        },
        callback => {
            /* if (lotInfo.lotStatus === 1) return callback(); */

            product.verifyMultiplePackageIds(lotProductInfo.packages, callback);
        },
        callback => {
            /* if (lotInfo.lotStatus === 1) return callback(); */

            let updatedLotInfo = {
                lotId: lotProductInfo.lotId,
                lotName: req.body.lotName,
                productId: req.body.productId,
                packageId: req.body.packageId,
                noOfCards: req.body.noOfCards,
                cardValue: req.body.cardValue,
                salesValue: req.body.salesValue,
                activeValueType: req.body.activeValueType,
                currencyId: req.body.currencyId,
                status: req.body.status,
                validationPeriod: req.body.validationPeriod,
                addOns: {
                    add: lotProductInfo.add,
                    del: lotProductInfo.del,
                    deletableProducts: lotProductInfo.deletableProducts,
                    deletablePackages: lotProductInfo.deletablePackages
                },
                updatedBy: sessionInfo['username']
            };
            lot.updateLotInfoWithAddOns(updatedLotInfo, callback);
        },
        callback => {
            /* if (lotInfo.lotStatus !== 1) return callback(); */

            updatedLotInfo = {
                lotId: req.body.lotId,
                cardValue: req.body.cardValue,
                salesValue: req.body.salesValue,
                activeValueType: req.body.activeValueType,
                validationPeriod: req.body.validationPeriod,
                updatedBy: sessionInfo['username']
            };
            lot.updateLotInfoWithCards(updatedLotInfo, callback);
        }
    ], err => {
        if (err) {
            return callback(err, req, res, data);
        }

        data.push({updatedCards: updatedLotInfo.updatedCards || 0});
        callback(null, req, res, data);
    })
});

router.post('/lot/delete', function (req, res) {
    let sessionInfo = {};

    async.series([
        callback => {
            common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        },
        callback => {
            lot.verifyLotId(req.body.lotId, callback);
        },
        callback => {
            lot.updateLotInfo({lotId: req.body.lotId, status: 0, updatedBy: sessionInfo['username']}, callback);
        }
    ], err => {
        if (err) {
            return callback(err, req, res);
        }

        callback(null, req, res);
    })
});

router.post('/lot/show', function (req, res) {
    let data = [];
    let sessionInfo = {};

    async.series([
        callback => {
            common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        },
        callback => {
            let filters = {
                lotId: req.body.filters.lotId,
                startDate: req.body.filters.startDate,
                endDate: req.body.filters.endDate,
                timezone: req.body.filters.timezone
            };

            lot.fetchLotInfo(filters, data, callback);
        }
    ], err => {
        if (err) {
            return callback(err, req, res, data);
        }

        callback(null, req, res, data, !req.body.lotId);
    })
});

router.post('/lot/check-updatable-cards', function (req, res) {
    let data = [];
    let sessionInfo = {};

    async.series([
        callback => {
            common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        },
        callback => {
            lot.checkForUpdatableCards(req.body.lotId, data, callback);
        }
    ], err => {
        if (err) {
            return callback(err, req, res);
        }

        callback(null, req, res, data);
    })
});

router.post('/lot/details', function (req, res) {
    let data = [];
    let sessionInfo = {};

    async.series([
        callback => {
            common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        },
        callback => {
            let filters = {
                lotId: req.body.lotId,
                purpose: req.body.purpose,
                status: req.body.status,
                startSerialNo: req.body.startSerialNo,
                limit: req.body.noOfCards,
                batchSize: req.body.batchSize
            };
            lot.fetchDetailLotInfo(filters, data, callback);
        }
    ], err => {
        if (err) {
            return callback(err, req, res);
        }

        callback(null, req, res, data);
    })
});

router.post('/lot/provision', function (req, res) {
    let sessionInfo = {};

    async.series([
        callback => {
            common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        },
        callback => {
            lot.checkProvisionLot(req.body.lotId, callback);
        },
        callback => {
            lot.provisionLot(req.body.lotId, sessionInfo['username'], callback);
        }
    ], err => {
        if (err) {
            return callback(err, req, res);
        }

        callback(null, req, res);
    })
});

router.post('/lot/provision-status', function (req, res) {
    let data = [];

    async.series([
        callback => {
            common.verifySession(req.body.userId, req.body.sessionId, callback, undefined, req.headers.referer);
        },
        callback => {
            lot.lotProvisionStatus(req.body.lotId, data, callback);
        }
    ], err => {
        if (err) {
            return callback(err, req, res);
        }

        callback(null, req, res, data);
    })
});
router.post('/lot/details/sales/portal', function (req, res) {
    let data = [];
    let sessionInfo = {};

    async.series([
        callback => {
            common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        },
        callback => {
            let filters = {
                lotId: req.body.lotId,
                purpose: req.body.purpose,
                status: req.body.status,
                startSerialNo: req.body.startSerialNo,
                limit: req.body.noOfCards,
                batchSize: req.body.batchSize,
                productId: req.body.productId,
                userId: req.body.userId,
            };
            lot.fetchDetailLotInfoForSalesPortal(filters, data, callback);
        }
    ], err => {
        if (err) {
            return callback(err, req, res);
        }

        callback(null, req, res, data);
    })
});


module.exports = router;
