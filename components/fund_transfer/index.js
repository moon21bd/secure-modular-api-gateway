'use strict';

const async = require('async');
const request = require('request');

const currency = require('../../components/currency');

const commonDBOperations = require('../../lib/common.db.operations');
const resGen = require('../../lib/result.codes');
const resDet = require('../../lib/result.details');
const utils = require('../../lib/utils');
const db = require('../../resources/database.connection');
const queries = require('./queries');
const config = require('../../config');
const common = require('../../components/common');

function fundTransferBySystem(addBalanceInfo, data, callback) {
    console.log("addBalanceInfo amount: ", addBalanceInfo.amount);
    addBalanceInfo.walletTypeId = addBalanceInfo.walletTypeId || -1;
    addBalanceInfo.productId = addBalanceInfo.productId || 0;
    addBalanceInfo.packageId = addBalanceInfo.packageId || 0;
    addBalanceInfo.referredTo = addBalanceInfo.referredTo || null;

    const fields = [
        addBalanceInfo.transferType, addBalanceInfo.refId, addBalanceInfo.userId,
        addBalanceInfo.amount, addBalanceInfo.channel, addBalanceInfo.username,
        addBalanceInfo.walletTypeId, addBalanceInfo.productId, addBalanceInfo.packageId,
        addBalanceInfo.referredTo
    ]
    /*
    let connection
    async.series([
        callback => {
            db.mysql.getConnection((err, conn) => {
                if (err) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                }

                connection = conn
                callback()
            })
        },
        callback => {
            const query = connection.format(queries.addBalance, fields)
            console.log("🚀 -> fundTransferBySystem -> query", query)
        }
    ], err => { })*/

    db.mysql.query(queries.addBalance, fields, function (err, results, fields) {
        if (err || results.length <= 0 || results[0].length <= 0) {
            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
        }

        let info = results[0][0];
        if (info.error_occurred === 1) {
            return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, info.result_description, info.error_code));
        }

        data.transactionId = info.transaction_id;
        data.newBalance = info.dst_user_new_balance;
        return callback();
    });
}

function fetchCommissionConfig(reqParams, container, callback) {
    let url = `${reqParams.url}?Amount=${reqParams.amount}&Seller-Id=${reqParams.roleId}`;
    if (reqParams.productId) url = url + `&Product-Id=${reqParams.productId}`;
    if (reqParams.packageId) url = url + `&Package-Id=${reqParams.packageId}`;
    if (reqParams.toRoleId) url = url + `&Buyer-Id=${reqParams.toRoleId}`;
    if (reqParams.splitWith) url = url + `&Split-With=${reqParams.splitWith}`;

    request(url, function (err, response, body) {
        console.log("pin generation fetchCommissionConfig error: ", err);
        if (err) {
            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
        }

        let parsedBody = JSON.parse(body);
        if (!parsedBody) return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR));

        if (parsedBody['code'] === 0) {
            container.config = parsedBody['data'][0];
        }

        return callback();
    });
}

function fetchParentInfo({
    userId
}, container, callback) {
    db.mysql.query(queries.fetchParentInfo, [userId],
        function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            if (results.length <= 0) {
                return callback(resGen.responseGenerator(resGen.NOT_FOUND));
            }

            Object.assign(container, results[0]);
            return callback();
        });
}

function fetchLastTransferredByInfo({
    userId,
    properties
}, container, callback) {
    properties = Object.assign({
        duration: 10000
    }, properties);
    const duration = Number(properties['duration']);

    db.mysql.query(queries.fetchLastTransferredByInfo, [duration, userId],
        function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            if (results.length <= 0) {
                return callback(resGen.responseGenerator(resGen.NOT_FOUND));
            }

            Object.assign(container, results[0]);
            return callback();
        });
}

function fetchGrandParentInfo({
    userId
}, container, callback) {
    db.mysql.query(queries.fetchGrandParentInfo, [userId],
        function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            if (results.length <= 0) {
                return callback(resGen.responseGenerator(resGen.NOT_FOUND));
            }

            Object.assign(container, results[0]);
            return callback();
        });
}

function fetchUserRoleId(userId, container, callback) {
    db.mysql.query(queries.fetchUserRoleId, [userId],
        function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            if (results.length <= 0) {
                return callback(resGen.responseGenerator(resGen.NOT_FOUND));
            }

            Object.assign(container, results[0]);
            return callback();
        });
}

function giftUserBalance(params, callback) {
    const commissionConfig = {};
    let config;
    async.series([
        callback => {
            if (params.roleId) return callback();

            fetchUserRoleId(params.userId, params, callback);
        },
        callback => {
            const userInfo = {};
            let found = false;

            async.series([
                callback => {
                    fetchLastTransferredByInfo({
                        userId: params.userId
                    }, userInfo, (err) => {
                        return callback();
                    });
                },
                callback => {
                    if (Object.keys(userInfo).length === 0) return callback();

                    fetchCommissionConfig({
                        url: params.url,
                        amount: params.amount,
                        productId: params.productId,
                        packageId: params.packageId,
                        roleId: params.roleId,
                        toRoleId: userInfo['roleId'],
                        splitWith: 'Last-Transferred-By'
                    }, commissionConfig, callback);
                },
                callback => {
                    found = (commissionConfig.config &&
                        commissionConfig.config['commissionConfigId'] !== null &&
                        commissionConfig.config['commissionConfigId'] !== "1"
                    );

                    if (found) return callback();

                    fetchParentInfo(params, userInfo, callback);
                },
                callback => {
                    if (found) return callback();

                    fetchCommissionConfig({
                        url: params.url,
                        amount: params.amount,
                        productId: params.productId,
                        packageId: params.packageId,
                        roleId: params.roleId,
                        toRoleId: userInfo['roleId'],
                        splitWith: 'Parent'
                    }, commissionConfig, callback);
                },
                callback => {
                    found = (commissionConfig.config &&
                        commissionConfig.config['commissionConfigId'] !== null &&
                        commissionConfig.config['commissionConfigId'] !== "1"
                    );

                    if (found) return callback();

                    fetchGrandParentInfo(params, userInfo, callback);
                },
                callback => {
                    if (found) return callback();

                    fetchCommissionConfig({
                        url: params.url,
                        amount: params.amount,
                        productId: params.productId,
                        packageId: params.packageId,
                        roleId: params.roleId,
                        toRoleId: userInfo['roleId'],
                        splitWith: 'Grand-Parent'
                    }, commissionConfig, callback);
                }
            ], err => {
                console.log("pin generation commissionConfig err: ", err);
                if (err) {
                    return callback(err);
                }

                return callback();
            });

        },
        callback => {
            if (!commissionConfig.config || commissionConfig.config['commissionConfigId'] === null) return callback();

            config = commissionConfig.config;
            if (config['effectiveCommission'] <= 0) return callback();

            let walletTypeId = -1;
            if (config['additionalProperties'] && config['additionalProperties']['walletTypeId']) {
                walletTypeId = config['additionalProperties']['walletTypeId'];
            }

            fundTransferBySystem({
                transferType: params.transferType,
                refId: params.refId,
                userId: params.userId,
                amount: config['effectiveCommission'],
                channel: params.channel,
                username: params.username,
                walletTypeId: walletTypeId,
                productId: params.productId,
                packageId: params.packageId
            }, {}, callback);
        },
        callback => {
            if (!commissionConfig.config ||
                commissionConfig.config['commissionConfigId'] === null ||
                commissionConfig.config['splitCommission'].length === 0
            ) return callback();

            let currentUserId = params.userId;
            let stop = false;

            async.eachOfSeries(config['splitCommission'], function (item, key, callback) {
                if (stop) return callback();

                if (item.commission <= 0) return callback();

                let fallThrough = false;
                const userInfo = {};

                async.series([
                    callback => {
                        const params = {
                            'userId': currentUserId,
                            'properties': item['additionalProperties']
                        };

                        switch (item['splitWith']) {
                            case 'Parent':
                                fetchParentInfo(params, userInfo, callback);
                                break;
                            case 'Last-Transferred-By':
                                fetchLastTransferredByInfo(params, userInfo, callback);
                                break;
                            case 'Grand-Parent':
                                fetchGrandParentInfo(params, userInfo, callback);
                                break;
                            default:
                                fallThrough = true;
                                stop = true;
                        }
                    },
                    callback => {
                        if (fallThrough || stop) return callback();
                        if (!item['additionalProperties'] ||
                            !item['additionalProperties']['roleId'] ||
                            (item['additionalProperties']['roleId'].toString() !== "-1" &&
                                userInfo.roleId.toString() !== item['additionalProperties']['roleId'].toString())) {
                            stop = true;
                            return callback();
                        }

                        let walletTypeId = -1;
                        if (item['additionalProperties'] && item['additionalProperties']['walletTypeId']) {
                            walletTypeId = item['additionalProperties']['walletTypeId'];
                        }

                        const referredTo = currentUserId;
                        currentUserId = userInfo.userId;
                        fundTransferBySystem({
                            transferType: params.transferType,
                            refId: params.refId,
                            userId: userInfo.userId,
                            referredTo: referredTo,
                            amount: item['commission'],
                            channel: params.channel,
                            username: params.username,
                            walletTypeId: walletTypeId,
                            productId: params.productId,
                            packageId: params.packageId
                        }, {}, callback);
                    }
                ], err => {
                    console.log("pin generation giftuserbalance err 329: ", err);
                    if (err) return callback(err);

                    callback();
                })
            }, err => {
                console.log("pin generation giftuserbalance err 335: ", err);
                if (err) {
                    return callback(err);
                }

                return callback();
            });
        }
    ], err => {
        console.log("pin generation giftuserbalance err 344: ", err);
        if (err) {
            return callback(err);
        }

        callback();
    });
}

function fetchCommissionConfigForSD(reqParams, container, callback) {
    let url = `${reqParams.url}?Amount=${reqParams.amount}&Product-Id=${reqParams.productId}&Commission-Type=Referral`;
    request(url, function (err, response, body) {
        if (err) {
            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
        }

        let parsedBody = JSON.parse(body);
        if (!parsedBody) return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR));

        if (parsedBody['code'] === 0) {
            container.config = parsedBody['data'][0];
        }

        return callback();
    });
}

function fetchCommissionForSelfUser(reqParams, container, callback) {
    let url = `${reqParams.url}?Product-Id=${reqParams.productId}&Split-With=${reqParams.splitWith}&Buyer-Id=${reqParams.buyerId}&Amount=${reqParams.amount}`;
    request(url, function (err, response, body) {
        if (err) {
            console.log("self user api error is", err);
            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
        }
        console.log("api commission reponse is", body);
        let parsedBody = JSON.parse(body);
        if (!parsedBody) return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR));

        if (parsedBody['code'] === 0) {
            container.config = parsedBody['data'][0];
        }

        return callback();
    });
}

function securityDepositCommission(params, callback) {
    const commissionConfig = {};
    let config;
    let referredBy = params.referredBy;
    let referredRoleId = params.roleId;
    async.series([
        callback => {
            fetchCommissionConfigForSD({
                url: params.url,
                amount: params.amount,
                productId: params.productId,
            }, commissionConfig, callback);
        },
        callback => {
            if (!commissionConfig.config || commissionConfig.config['commissionConfigId'] === null) return callback();

            config = commissionConfig.config;
            if (config['effectiveCommission'] <= 0) return callback();

            let walletTypeId = -1;
            if (config['additionalProperties'] && config['additionalProperties']['walletTypeId']) {
                walletTypeId = config['additionalProperties']['walletTypeId'];
            }
            let data = {
                transferType: params.transferType,
                refId: params.refId,
                userId: params.userId,
                amount: config['effectiveCommission'],
                channel: params.channel,
                username: params.username,
                walletTypeId: walletTypeId,
                productId: params.productId,
                packageId: params.packageId
            };
            fundTransferBySystem(data, {}, callback);
        },
        callback => {
            if (!commissionConfig.config ||
                commissionConfig.config['commissionConfigId'] === null ||
                commissionConfig.config['splitCommission'].length === 0
            ) return callback();
            let currentUserId = params.userId;
            let stop = false;

            async.eachOfSeries(config['splitCommission'], function (item, key, callback) {
                if (stop) return callback();

                if (item.commission <= 0) return callback();

                let fallThrough = false;
                let userInfo = {
                    userId: referredBy,
                    roleId: referredRoleId
                }

                let mainUserId = 0;
                let mainReferredId = 0;

                async.series([
                    callback => {
                        const params = {
                            'userId': currentUserId,
                            'properties': item['additionalProperties']
                        };

                        switch (item['splitWith']) {
                            case 'Parent':
                                callback();
                                break;
                            case 'Grand-Parent':
                                fetchUserRoleId(referredBy, userInfo, callback)
                                break;
                            default:
                                fallThrough = true;
                                stop = true;
                        }
                    },
                    callback => {
                        if (userInfo["referredBy"]) {
                            userInfo["userId"] = userInfo["referredBy"];
                        }
                        if (fallThrough || stop) return callback();
                        if (!item['additionalProperties'] ||
                            !item['additionalProperties']['roleId'] ||
                            (item['additionalProperties']['roleId'].toString() !== "-1" &&
                                userInfo.roleId.toString() !== item['additionalProperties']['roleId'].toString())) {
                            stop = true;
                            return callback();
                        }

                        let walletTypeId = -1;
                        if (item['additionalProperties'] && item['additionalProperties']['walletTypeId']) {
                            walletTypeId = item['additionalProperties']['walletTypeId'];
                        }

                        const referredTo = currentUserId;
                        currentUserId = userInfo.userId;
                        mainUserId = userInfo.userId;
                        mainReferredId = referredTo;
                        if (userInfo.userId == referredTo) {
                            return callback();
                        }

                        let data = {
                            transferType: params.transferType,
                            refId: params.refId,
                            userId: userInfo.userId,
                            referredTo: referredTo,
                            amount: item['commission'],
                            channel: params.channel,
                            username: params.username,
                            walletTypeId: walletTypeId,
                            productId: params.productId,
                            packageId: params.packageId
                        };
                        fundTransferBySystem(data, {}, callback);
                    },
                    callback => {
                        if (mainUserId == mainReferredId) {
                            return callback();
                        }
                        let data = {
                            userNameOrId: userInfo["userId"],
                            title: 'Sign-up commission received',
                            body: `Congratulations, you have earned ${item['commission']} points`,
                        };
                        common.sendNotification(data, callback);
                    }
                ], err => {
                    if (err) return callback(err);

                    callback();
                })
            }, err => {
                if (err) {
                    return callback(err);
                }

                return callback();
            });
        }
    ], err => {
        if (err) {
            return callback(err);
        }

        callback();
    });
}
module.exports = {
    createFundTransferConfig: function (fundTransferConfig, data, callback) {
        let replacements = [
            fundTransferConfig.from, fundTransferConfig.to, fundTransferConfig.productId, fundTransferConfig.isAllowed,
            fundTransferConfig.allowType, fundTransferConfig.comission, fundTransferConfig.createdBy
        ];

        db.mysql.query(queries.insertFundTransferConfig, replacements,
            function (err, results, fields) {
                if (err && err.code === 'ER_DUP_ENTRY') {
                    return callback(resGen.responseGenerator(resGen.ACTION_NOT_SUPPORTED_ERR, `Duplicate point-transfer configuration found`));
                }

                if (err) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                }

                data.insertId = results.insertId;

                callback();
            });
    },
    updateFundTransferConfig: function (fundTransferConfig, callback) {
        let replacements = [
            fundTransferConfig.productId, fundTransferConfig.productId, fundTransferConfig.productId,
            fundTransferConfig.status, fundTransferConfig.status, fundTransferConfig.isAllowed,
            fundTransferConfig.isAllowed, fundTransferConfig.allowType, fundTransferConfig.allowType,
            fundTransferConfig.comission, fundTransferConfig.comission, fundTransferConfig.updatedBy,
            fundTransferConfig.configId
        ];

        db.mysql.query(queries.updateFundTransferConfig, replacements,
            function (err, results, fields) {
                if (err && err.code === 'ER_DUP_ENTRY') {
                    return callback(resGen.responseGenerator(resGen.ACTION_NOT_SUPPORTED_ERR, `Duplicate point-transfer configuration found for Config-Id [${fundTransferConfig.configId}]`));
                }

                if (err) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                }

                if (results.affectedRows === 0) {
                    return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR));
                }

                callback();
            });
    },
    showFundTransferConfig: function (fundTransferConfig, data, callback) {
        let condition = utils.generateDynamicWhereCondition(['tc.transfer_config_id'], [fundTransferConfig.configId]);
        commonDBOperations.fetch(queries.fetchFundTransferConfig(condition.whereCondition), condition.replacements, data, callback);
    },
    checkForDuplicateFundTransferConfig: function (fundTransferConfig, callback) {
        let data = [];
        async.series([
            callback => {
                let condition = utils.generateDynamicWhereCondition(
                    ['transfer_from', 'transfer_to', 'transfer_product_id'],
                    [fundTransferConfig.from, fundTransferConfig.to, fundTransferConfig.productId ? fundTransferConfig.productId : null],
                    ['=', '=', (fundTransferConfig.productId ? '=' : 'IS')]
                );

                commonDBOperations.fetch(queries.fetchFundTransferConfig(condition.whereCondition), condition.replacements, data, callback);
            },
            callback => {
                if (data.length !== 0) {
                    return callback(resGen.responseGenerator(resGen.ACTION_NOT_SUPPORTED_ERR, `Duplicate point-transfer configuration found for [from (${fundTransferConfig.from}), to (${fundTransferConfig.to})]`));
                }

                return callback();
            }
        ], err => {
            if (err) {
                return callback(err);
            }

            return callback();
        });
    },
    checkIfFundTransferConfigExists: function (fundTransferConfig, callback) {
        let data = [];
        async.series([
            callback => {
                let condition = utils.generateDynamicWhereCondition(['transfer_config_id'], [fundTransferConfig.configId]);
                commonDBOperations.fetch(queries.fetchFundTransferConfig(condition.whereCondition), condition.replacements, data, callback);
            },
            callback => {
                if (data.length === 0) {
                    return callback(resGen.responseGenerator(resGen.NOT_FOUND, 'No point-transfer configuration found for config id [' + fundTransferConfig.configId + ']'));
                }

                fundTransferConfig['from'] = data[0]['from'];
                fundTransferConfig['to'] = data[0]['to'];
                return callback();
            }
        ], err => {
            if (err) {
                return callback(err);
            }

            return callback();
        });
    },
    checkForRoleIds: function (fundTransferConfig, callback) {
        let data = [];

        commonDBOperations.fetch(queries.checkForRoleIds, [fundTransferConfig.from, fundTransferConfig.to], data,
            (err) => {
                if (err) {
                    return callback(err);
                }

                let expectedCounter = fundTransferConfig.from === fundTransferConfig.to ? 1 : 2;
                if (data.length === 0 || data[0].count !== expectedCounter) {
                    return callback(resGen.responseGenerator(resGen.NOT_FOUND, 'from/to not found'));
                }

                callback();
            });
    },
    retrieveFundTransferInformation: function (transferFrom, transferTo, fundTransferInfo, callback) {
        db.mysql.query(queries.retrieveDataForFundTransfer, [transferFrom, transferTo],
            function (err, results, fields) {
                if (err) { 
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                }

                if (results.length === 0) {
                    return callback(resGen.responseGenerator(resGen.NOT_FOUND, 'No information of point sender/receiver found', resDet.BOTH_FUND_SENDER_RECEIVER_NOT_FOUND));
                }

                if (results.length === 1) {
                    if (results[0].id === transferFrom) {
                        return callback(resGen.responseGenerator(resGen.NOT_FOUND, 'No information of point receiver found', resDet.FUND_RECEIVER_NOT_FOUND));
                    } else {
                        return callback(resGen.responseGenerator(resGen.NOT_FOUND, 'No information of point sender found', resDet.FUND_SENDER_NOT_FOUND));
                    }
                }

                Object.keys(results)
                    .forEach(index => {
                        const row = results[index];
                        fundTransferInfo[row.id] = {};
                        Object.keys(row).forEach(columnName => fundTransferInfo[row.id][columnName] = row[columnName]);
                    });

                callback();
            });
    },
    executeFundTransferProcedure: function (verifyFundTransfer, fundTransferInfo, request, data, callback) {
        db.mysql.query(queries.fundTransferQuery, [
            verifyFundTransfer,
            request.transferType,
            fundTransferInfo[request.transferFrom].id,
            fundTransferInfo[request.transferTo].id,
            fundTransferInfo[request.transferFrom].roleId,
            fundTransferInfo[request.transferTo].roleId,
            request.amount, fundTransferInfo[request.transferFrom].currencyId,
            request.currencyId, request.channel, request.walletTypeId || -1, request.username
        ],
            function (err, results, fields) {
                if (err) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                }

                if (results.length < 2 || results[0].length < 1) {
                    return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR));
                }

                const row = results[0][0];
                if (row.error_occurred === 1 && row.error_code === resDet.INSUFFICIENT_USER_BALANCE) {
                    data.currentUserBalance = row.src_current_user_balance;
                    return callback(resGen.responseGenerator(resGen.INSUFFICIENT_RESOURCE, row.result_description, row.error_code, undefined, data));
                }

                if (row.error_occurred === 1) {
                    return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, row.result_description, row.error_code));
                }

                data.allowSales = row.is_sales === 1;
                data.comission = row.comission_amount_for_src_user;
                data.deductableAmount = row.deductable_amount;
                if (verifyFundTransfer) {

                    data.conversionRateToGivenCurrency = row.conversion_rate_to_given_currency;
                    data.senderComissionInPercent = row.comission_for_src_user;
                } else {
                    data.currentUserBalance = row.src_current_user_balance;
                    data.transactionId = row.transaction_id;
                }

                callback();
            });
    },
    fundTransferBySystem: fundTransferBySystem,
    getCommissionDetails: function (transferDetails, commissionDetails, callback) {
        db.mysql.query(queries.commissionSpilltingDetails, [
            transferDetails.userId, transferDetails.transferType, transferDetails.commission, transferDetails.productId, transferDetails.channel
        ],
            function (err, results, fields) {
                if (err || results.length <= 0 || results[0].length <= 0) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                }

                let info = results[0][0];



                commissionDetails.beneficiary_amount = info.beneficiary_amount;
                commissionDetails.beneficiary_id = info.beneficiary_id;


                return callback();
            });

    },

    transactionCommissionDiverse: function (commissionDetailsInfo, transactionCommissionId, callback) {

        db.mysql.query(queries.insertTransferCommission, [
            commissionDetailsInfo.beneficiaryId,
            commissionDetailsInfo.cashTransactionType,
            commissionDetailsInfo.cashTransactionId,
            commissionDetailsInfo.cashAgentId,
            commissionDetailsInfo.productId,
            commissionDetailsInfo.cashPlatformProductId,
            commissionDetailsInfo.originalAmount,
            commissionDetailsInfo.commission,
            commissionDetailsInfo.cashStatus,
            commissionDetailsInfo.cashRemarks,
            commissionDetailsInfo.username
        ],
            function (err, results, fields) {


                if (results) {
                    transactionCommissionId.insertId = results.insertId;
                }


                return callback();
            });

    },
    addTransactionCommission: function ({
        transactionCommissionId,
        status,
        remarks,
        agentId,
        transactionId,
        amount,
        commissionAmount,
        productCode,
        productCategoryId,
        requestedBy
    }, container, callback) {
        db.mysql.query(queries.callTransactionCommissionProc,
            [transactionCommissionId, status, remarks, agentId, transactionId,
                amount, commissionAmount, productCode, productCategoryId, requestedBy
            ],
            function (err, results, fields) {
                if (err || results.length <= 0) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                }

                let info = results[0][0];
                if (info['error_occurred'] === 1) {
                    return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, info['error_description']));
                }

                container['transactionCommissionId'] = info['gen_trx_comm_id'];
                try {
                    container['commissionAfter'] = Number(info['@commission_after']);
                } catch (e) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, 'Invalid interval value for Deferred commission'));
                }

                container['status'] = info['@status'];
                container['productId'] = info['@product_id'];
                container['categoryId'] = info['@product_category_id'];
                container['executionConfigId'] = info['@product_execution_config_id'];
                container['currencyId'] = info['@product_currency_id'];
                container['commission'] = info['given_commission_amount'];
                container['userId'] = info['@user_id'];
                container['username'] = info['@user_name'];
                return callback();
            });
    },
    updateTransactionCommission: function ({
        transactionCommissionId,
        status,
        remarks,
        updatedBy
    }, callback) {
        db.mysql.query(queries.updateTransactionCommission,
            [status, remarks, updatedBy, transactionCommissionId],
            function (err, results, fields) {
                if (err) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                }

                if (results.affectedRows === 0) {
                    return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, 'Incorrect transaction-commission id'));
                }

                return callback();
            });
    },
    doGiftUserBalance: function ({
        amount,
        productId,
        packageId,
        userId,
        roleId,
        toRoleId,
        channel,
        refId,
        currencyId
    }, callback) {
        if (!config.giftBalance.enable) return callback();

        amount = Number(amount);
        productId = productId || 0;

        currencyId = currencyId || 1;
        const currencyInfo = currency.getCurrencyInfoUsingId(currencyId);
        const conversionRate = currencyInfo ? currencyInfo.currencyConversionRate : 1;
        amount = utils.roundAmount(amount / conversionRate, config.roundamount.ceil);

        giftUserBalance({
            url: config.giftBalance.commissionConfigAPI,
            amount: amount,
            productId: productId,
            packageId: packageId,
            userId: userId,
            roleId: roleId,
            toRoleId: toRoleId,
            transferType: config.giftBalance.transferType,
            channel: channel,
            username: config.giftBalance.systemUserName,
            refId: refId
        }, (err) => {
            console.log("pin generation doGiftUserBalance error: ", err);
            if (err) {
                config.logger.error(err);
            }
            callback();
        });
    },
    storeFundTransferRecord: function (request, callback) {
        db.mysql.query(queries.storeFundTransferRecord, [
            request.transferRefId, request.from, request.to, request.type, request.paymentChannel,
            request.currency, request.amount, request.baseAmount, request.toAmount, request.prevBalance,
            request.newBalance, request.status, request.note, request.channel, request.createdBy
        ], (err, results, fields) => {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }
            return callback();
        });
    },
    migrateRoleReferralCommission: function (arug, callback) {
        if (!config.giftBalance.enable) return callback();
        let amount = Number(arug.amount);
        let productId = arug.productId || 0;
        let currencyId = 1; //currencyId || 1;
        const currencyInfo = currency.getCurrencyInfoUsingId(currencyId);
        const conversionRate = currencyInfo ? currencyInfo.currencyConversionRate : 1;
        amount = utils.roundAmount(amount / conversionRate, config.roundamount.ceil);
        let data = {
            url: config.giftSignup.commissionConfigAPI,
            amount: amount,
            productId: productId,
            userId: arug.userId,
            referredBy: arug.referredBy,
            roleId: arug.roleId,
            toRoleId: arug.toRoleId,
            transferType: config.giftSignup.transferType,
            username: config.giftSignup.systemUserName,
            channel: 'platform',
            refId: Date.now()
        };
        securityDepositCommission(data, (err) => {
            if (err) {
                config.logger.error(err);
                callback(err);
            }
            callback();
        });
    },

    userSelfCommision: function (argu, callback) {
        let commissionConfig = {};
        let configResult;
        async.series([
            callback => {
                let data = {
                    url: config.giftBalance.commissionConfigAPI,
                    productId: argu.productId,
                    buyerId: argu.commissionRoleId,
                    amount: argu.deductedAmount,
                    splitWith: 'Self'
                };
                fetchCommissionForSelfUser(data, commissionConfig, callback);
            },
            callback => {
                if (!commissionConfig.config || commissionConfig.config['commissionConfigId'] === null || commissionConfig.config['effectiveCommission'] <= 0) return callback();
                configResult = commissionConfig.config;
                // if (config['effectiveCommission'] <= 0) return callback();

                let fundTransferData = {
                    transferType: config.giftBalance.transferType,
                    refId: `s_${argu.transactionRefId}`,
                    userId: argu.userId,
                    amount: configResult['effectiveCommission'],//api theke pabo
                    channel: argu.channel,// platform
                    username: config.giftBalance.systemUserName,
                    walletTypeId: 1,
                    productId: argu.productId,
                    packageId: argu.packageId
                };
                fundTransferBySystem(fundTransferData, {}, callback);
            }
        ], err => {
            if (err) {
                callback(err);
            }
            callback();
        })
    }
};
