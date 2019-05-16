'use strict';

const express = require('express');
const async = require('async');

const common = require('../components/common');
const user = require('../components/user');
const userMigration = require('../components/user_migration');
const fundTransfer = require('../components/fund_transfer');
const product = require('../components/product');

const db = require('../resources/database.connection');
const resGen = require('../lib/result.codes');
const resDet = require('../lib/result.details');

const cfg = require('../config');

const router = express.Router();

const callback = common.callback;

router.post('/fund-transfer-config/create', function (req, res) {
    let sessionInfo = {};
    let container = {};
    let data = [];

    let fundTransferConfig = {
        from: req.body.from,
        to: req.body.to,
        productId: req.body.productId === 0 ? undefined : req.body.productId,
        isAllowed: (req.body.isAllowed !== undefined) ? req.body.isAllowed : 1,
        allowType: (req.body.allowType !== undefined) ? req.body.allowType : 0,
        comission: req.body.comission
    };

    async.series([
        callback => {
            common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        },
        callback => {
            fundTransfer.checkForRoleIds(fundTransferConfig, callback);
        },
        callback => {
            if (!fundTransferConfig.productId) return callback();

            product.verifyProductId(fundTransferConfig.productId, callback);
        },
        callback => {
            fundTransfer.checkForDuplicateFundTransferConfig(fundTransferConfig, callback);
        },
        callback => {
            fundTransferConfig.createdBy = sessionInfo['username'];
            fundTransfer.createFundTransferConfig(fundTransferConfig, container, callback);
        },
        callback => {
            fundTransfer.showFundTransferConfig({
                configId: container.insertId
            }, data, callback);
        }
    ], err => {
        if (err) {
            return callback(err, req, res);
        }

        callback(null, req, res, data);
    });
});

router.post('/fund-transfer-config/update', function (req, res) {
    let sessionInfo = {};

    let fundTransferConfig = {
        configId: req.body.configId,
        productId: req.body.updatedFields.productId,
        status: req.body.updatedFields.status,
        isAllowed: (req.body.updatedFields.isAllowed !== undefined) ? req.body.updatedFields.isAllowed : 1,
        allowType: (req.body.updatedFields.allowType !== undefined) ? req.body.updatedFields.allowType : 0,
        comission: req.body.updatedFields.comission
    };

    async.series([
        callback => {
            common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        },
        callback => {
            fundTransfer.checkIfFundTransferConfigExists(fundTransferConfig, callback);
        },
        callback => {
            if (fundTransferConfig.productId === undefined) return callback();

            fundTransfer.checkForDuplicateFundTransferConfig(fundTransferConfig, callback);
        },
        callback => {
            if (!fundTransferConfig.productId) return callback();

            product.verifyProductId(fundTransferConfig.productId, callback);
        },
        callback => {
            fundTransferConfig.updatedBy = sessionInfo['username'];
            fundTransfer.updateFundTransferConfig(fundTransferConfig, callback);
        }
    ], err => {
        if (err) {
            return callback(err, req, res);
        }

        callback(null, req, res);
    });
});

router.post('/fund-transfer-config/show', function (req, res) {
    let sessionInfo = {};
    let data = [];

    let fundTransferConfig = {
        configId: req.body.configId,
    };

    async.series([
        callback => {
            common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        },
        callback => {
            fundTransfer.showFundTransferConfig(fundTransferConfig, data, callback);
        },
        callback => {
            if (fundTransferConfig.configId && data.length === 0) {
                return callback(resGen.responseGenerator(resGen.NOT_FOUND, undefined, resDet.NO_TRANSFER_CONFIG_FOUND));
            }
            callback();
        }
    ], err => {
        if (err) {
            return callback(err, req, res);
        }

        callback(null, req, res, data);
    });
});

router.post('/check-fund-transfer', function (req, res) {
    let data = {};
    let fundTransferInfo = {};

    req.body.transferFrom = Number(req.body.transferFrom);
    req.body.transferTo = Number(req.body.transferTo);
    async.series([
        callback => {
            common.verifySession(req.body.transferFrom, req.body.sessionId, callback, undefined, req.headers.referer);
        },
        callback => {
            fundTransfer.retrieveFundTransferInformation(req.body.transferFrom, req.body.transferTo, fundTransferInfo, callback);
        },
        callback => {
            /*all callculation done in base currencry that;s why its made fixed to 1 means points and requested amount converted to points*/
            req.body.amount = req.body.amount / fundTransferInfo[req.body.transferFrom].conversionRate;
            req.body.currencyId = '1'; /*all callculation done in base currencry that;s why its made fixed to 1 means points*/
            return callback();

        },
        callback => {
            if (fundTransferInfo[req.body.transferFrom].passwordAuthentication === 0) return callback();

            common.verifyPassword(
                req.body.password,
                fundTransferInfo[req.body.transferFrom].password,
                fundTransferInfo[req.body.transferFrom].passwordExpiry,
                callback);
        },
        callback => {
            req.body.transferType = 0;
            req.body.channel = '';
            fundTransfer.executeFundTransferProcedure(true, fundTransferInfo, req.body, data, callback);
        },
        callback => {
            data.receiverId = req.body.transferTo;
            data.receiverName = fundTransferInfo[req.body.transferTo].username;
            data.receiverCurrencyName = fundTransferInfo[req.body.transferTo].currencyName;


            let amountInBaseCurrency = data.deductableAmount; /*req.body.amount / data.conversionRateToGivenCurrency*/ ;
            data.amountInSenderCurrency =
                parseFloat(((amountInBaseCurrency - data.comission) * fundTransferInfo[req.body.transferFrom].conversionRate).toFixed(2));
            data.amountInReceiverCurrency =
                parseFloat(((req.body.amount / data.conversionRateToGivenCurrency) * fundTransferInfo[req.body.transferTo].conversionRate).toFixed(2));
            delete data.conversionRateToGivenCurrency;

            callback();
        }
    ], err => {
        if (err) {
            return callback(err, req, res, data);
        }

        callback(null, req, res, data);
    });
});

router.post('/fund-transfer', function (req, res) {
    let data = {};
    let sessionInfo = {};
    let fundTransferInfo = {};

    req.body.transferFrom = Number(req.body.transferFrom);
    req.body.transferTo = Number(req.body.transferTo);
    async.series([
        callback => {
            common.verifySession(req.body.transferFrom, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        },
        callback => {
            req.body.username = sessionInfo.username;
            fundTransfer.retrieveFundTransferInformation(req.body.transferFrom, req.body.transferTo, fundTransferInfo, callback);
        },
        callback => {
            /*all callculation done in base currencry that;s why its made fixed to 1 means points and requested amount converted to points*/
            req.body.amount = req.body.amount / fundTransferInfo[req.body.transferFrom].conversionRate;
            req.body.currencyId = '1'; /*all callculation done in base currencry that;s why its made fixed to 1 means points*/
            return callback();
        },
        callback => {
            if (fundTransferInfo[req.body.transferFrom].passwordAuthentication === 0) return callback();

            common.verifyPassword(
                req.body.password,
                fundTransferInfo[req.body.transferFrom].password,
                fundTransferInfo[req.body.transferFrom].passwordExpiry,
                callback);
        },
        callback => {
            data.fundTransferEmailAuthentication = fundTransferInfo[req.body.transferFrom].emailAuthentication;

            if (data.fundTransferEmailAuthentication === 1 || data.fundTransferEmailAuthentication === 2) return callback();

            fundTransfer.executeFundTransferProcedure(false, fundTransferInfo, req.body, data, callback);
        },
        /* callback => {
            if (data.fundTransferEmailAuthentication !== 0) return callback();

            fundTransfer.doGiftUserBalance({
                amount: req.body.amount,
                userId: fundTransferInfo[req.body.transferFrom].id,
                roleId: fundTransferInfo[req.body.transferFrom].roleId,
                toRoleId: fundTransferInfo[req.body.transferTo].roleId,
                channel: req.body.channel,
                refId: data.transactionId,
                currencyId: req.body.currencyId
            }, callback);
        }, */
        callback => {
            if (data.fundTransferEmailAuthentication === 0 || data.fundTransferEmailAuthentication === 2) return callback();

            let info = {
                fundTransferInfo: fundTransferInfo,
                request: req.body,
                purpose: 'fund-transfer',
                userId: req.body.transferFrom,
                receiver: fundTransferInfo[req.body.transferFrom].email,
            };

            common.sendOtpEmail(info, data, callback);
        },
        callback => {
            if (data.fundTransferEmailAuthentication === 0 || data.fundTransferEmailAuthentication === 1) return callback();

            let info = {
                fundTransferInfo: fundTransferInfo,
                request: req.body,
                purpose: 'fund-transfer',
                userId: req.body.transferFrom,
                receiver: fundTransferInfo[req.body.transferFrom].email,
                mobileNo: fundTransferInfo[req.body.transferFrom].mobileNo,
                countryCode: fundTransferInfo[req.body.transferFrom].countryCode

            };

            common.sendOtpSms(info, data, callback);
        },
        callback => {
            //if (fundTransferInfo[req.body.transferFrom]['roleId'] === 8) {
            
                let data = {
                    userId: Number(req.body.transferTo),
                    transactionAmount: req.body.amount,
                    migrateType: 'automatic'
                }
			userMigration.migrateUserRole(data, callback);
            //}

        },
    ], err => {
        if (err && err.errorType != 'migrateUserRole') {
            console.log("Error list: ", err);
            return callback(err, req, res, data);
            
        }
        callback(null, req, res, data);
    });
});

router.post('/add-balance', function (req, res) {
    let sessionInfo = {};
    let data = {};

    async.series([
        callback => {
            common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        },
        callback => {
            user.checkIfUserCurrencyIsActive(req.body.userId, callback);
        },
        callback => {
            async.eachSeries(cfg.mail.adminbalance, function (item, callback) {
                let info = {
                    purpose: 'add-balance',
                    subject: 'Token for Admin balance',
                    transferType: 4, // Admin-balance
                    userId: item.userId,
                    username: sessionInfo['username'],
                    amount: req.body.amount,
                    channel: req.body.channel,
                    receiver: item.email
                };
                return common.sendOtpEmail(info, data, callback);
            }, err => {
                if (err) {
                    return callback(err);
                }

                return callback();
            });
        }
    ], err => {
        if (err) {
            return callback(err, req, res);
        }

        return callback(err, req, res);
    });
});

router.post('/transaction-commission/update', function (req, res) {
    let sessionInfo = {};

    async.series([
        callback => {
            common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        },
        callback => {
            if (req.body.status === 2) return callback();

            fundTransfer.addTransactionCommission({
                transactionCommissionId: req.body.transactionCommissionId,
                status: req.body.status,
                remarks: req.body.remarks,
                requestedBy: sessionInfo['username']
            }, {}, callback);
        },
        callback => {
            if (req.body.status !== 2) return callback();

            fundTransfer.updateTransactionCommission({
                transactionCommissionId: req.body.transactionCommissionId,
                status: 1,
                remarks: req.body.remarks,
                updatedBy: sessionInfo['username']
            }, callback);
        },
        callback => {
            updateExecutionHistoryForTransactionCommission({
                executionType: 8,
                transactionCommissionId: req.body.transactionCommissionId,
                status: req.body.status !== 0 ? 1 : 0,
                remarks: req.body.remarks,
                updatedBy: sessionInfo['username']
            }, callback);
        }
    ], err => {
        if (err) {
            return callback(err, req, res);
        }

        return callback(err, req, res);
    });
});

function updateExecutionHistoryForTransactionCommission({
    executionType,
    transactionCommissionId,
    status,
    remarks,
    updatedBy
}, callback) {
    db.mysql.query(`
        UPDATE platform_execution_history 
        SET execution_status = ?, execution_remarks = ?, updated_by = ?
        WHERE execution_client_transaction_id = ? AND execution_type = ? AND execution_status = 2
    `, [status, remarks, updatedBy, transactionCommissionId, executionType], (err, results, fields) => {
        if (err) {
            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
        }

        return callback();
    });
}

module.exports = router;
