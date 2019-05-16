'use strict';

const async = require('async');
const moment = require('moment');

const currency = require('../currency');
const order = require('../order');

const db = require('../../resources/database.connection');
const resGen = require('../../lib/result.codes');
const resDet = require('../../lib/result.details');
const utils = require('../../lib/utils');
const config = require('../../config');

const queries = require('./queries');

function retrieveCardInfoUsingSpecificPartition(hrn, cardInfo, callback) {
    db.mysql.query(queries.cardInfo, [hrn], function (err, results, fields) {
        if (err) {
            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
        }

        if (results.length === 0) {
            return callback(resGen.responseGenerator(resGen.NOT_FOUND, `No card information found for pin[${hrn}]`, resDet.INVALID_PIN));
        }

        if (results[0].status === 0) {
            return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, `Card is not active for pin[${hrn}]`, resDet.INACTIVE_PIN));
        }

        if (results[0].status === 2) {
            return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, `Card is used for pin[${hrn}]`, resDet.USED_PIN));
        }

        if (moment(results[0].expiryDate).toDate().getTime() < new Date().getTime()) {
            return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, `Card expired for pin[${hrn}]`, resDet.EXPIRED_PIN));
        }

        if (results[0].activeValueType !== 0) {
            results[0].amount = -1;
            results[0].salesAmount = -1;
            results[0].currencyId = -1;
        }

        Object.assign(cardInfo, results[0]);
        return callback();
    });
}

function retrieveCardInfoUsingSpecificPartitionForCheck(hrn, cardInfo, callback) {
    db.mysql.query(queries.cardInfo, [hrn], function (err, results, fields) {
        if (err) {
            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
        }

        if (results.length === 0) {
            return callback(resGen.responseGenerator(resGen.NOT_FOUND, `No card information found for pin[${hrn}]`, resDet.INVALID_PIN));
        }

        if (results[0].status === 0) {
            return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, `Card is not active for pin[${hrn}]`, resDet.INACTIVE_PIN));
        }

        Object.assign(cardInfo, results[0]);
        return callback();
    });
}

function retrieveCardInfoForCheck(hrn, cardInfo, callback) {
    retrieveCardInfoUsingSpecificPartitionForCheck(hrn, cardInfo, callback);
}

function retrieveCardInfoUsingSerialNo(serialNo, cardInfo, callback) {
    db.mysql.query(queries.cardInfoUsingSerialNo, [serialNo], function (err, results, fields) {
        if (err) {
            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
        }

        if (results.length === 0) {
            return callback(resGen.responseGenerator(resGen.NOT_FOUND, `No card information found for serial no [${serialNo}]`, resDet.INVALID_SERIAL_NO));
        }

        if (results[0].status === 0) {
            return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, `Card is not active for serial no [${serialNo}]`, resDet.INACTIVE_SERIAL_NO));
        }

        Object.assign(cardInfo, results[0]);
        return callback();
    });
}

function updateCardOwnershipTransferStatus(ownershipTransferId, updatedStatus, remarks, updatedBy, callback, connection) {
    connection = connection || db.mysql;

    connection.query(queries.updateCardTransferStatus,
        [updatedStatus, remarks, updatedBy, ownershipTransferId],
        function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            if (results.affectedRows === 0) {
                return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, 'Incorrect ownership transfer id/status'))
            }

            return callback();
        });
}

function retrieveCardInfoUsingSpecificPartitionForDialer(hrn, cardInfo, callback) {
    db.mysql.query(queries.cardInfo, [hrn], function (err, results, fields) {
        if (err) {
            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));

        }

        if (results.length === 0) {
            return callback(resGen.responseGenerator(resGen.NOT_FOUND, `No card information found for pin[${hrn}]`, resDet.INVALID_PIN));
        }

        if (results[0].status === 0) {
            return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, `Card is not active for pin[${hrn}]`, resDet.INACTIVE_PIN));
        }

        if (results[0].status === 2) {
            return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, `Card is used for pin[${hrn}]`, resDet.USED_PIN));
        }

        if (moment(results[0].expiryDate).toDate().getTime() < new Date().getTime()) {
            return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, `Card expired for pin[${hrn}]`, resDet.EXPIRED_PIN));
        }

        Object.assign(cardInfo, results[0]);
        return callback();
    });
}

function retrieveCardInfoForImpact(userId, productId, cardInfo, callback) {
    db.mysql.query(queries.cardInfoForImpact, [userId, productId], function (err, results, fields) {
        if (err) {
            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
        }

        if (results.length === 0) {
            return callback(resGen.responseGenerator(resGen.NOT_FOUND, "No card information available"));
        }

        Object.assign(cardInfo, results[0]);
        return callback();
    });
}

function retrieveCardStatisticForImpact(userId, cardInfo, callback) {
    db.mysql.query(queries.cardStatisticForImpact, [userId], function (err, results, fields) {
        if (err) {
            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
        }

        if (results.length) {
            cardInfo.push(...results);
        }

        return callback();
    });
}

function retrieveAllProductIdAgainstALot(lotID, productIdsEachLot, callback) {
    db.mysql.query(queries.retrieveAllProductIdAgainstALot, [lotID], function (err, results, fields) {
        if (err) {
            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
        }

        Object.keys(results).forEach((index) => {
            productIdsEachLot.push(results[index].productId);
        });

        return callback();
    });
}

function updateCardInfo(context, callback) {
    let replacements = [context.status, context.channel, context.orderdBy, context.updatedBy, context.serialNo];
    db.mysql.query(queries.updateCardInfo, replacements, function (err, results, fields) {
        if (err || results.affectedRows === 0) {
            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
        }

        return callback();
    });
}

module.exports = {
    changeStatus: function (cardInfo, data, callback) {
        db.mysql.query(queries.changeStatus,
            [
                cardInfo.updatedStatus, cardInfo.username, cardInfo.startSerialNo, cardInfo.endSerialNo, cardInfo.preStatus
            ],
            function (err, results, fields) {
                if (err) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                }

                data.affectedNoOfCards = results.affectedRows;
                callback();
            });
    },
    getCardSummary: function (startSerialNo, endSerialNo, data, callback) {
        db.mysql.query(queries.cardSummary, [startSerialNo, endSerialNo],
            function (err, results, fields) {
                if (err || results.length <= 0) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                }

                results[0].totalFree = results[0].totalFree || 0;
                results[0].totalActive = results[0].totalActive || 0;
                results[0].total = results[0].total || 0;

                Object.assign(data, results[0]);
                callback();
            });
    },
    initiateTransferCardsOwnership: function (cardInfo, data, callback) {
        let replacements = [
            1, cardInfo.userId, cardInfo.assignedTo, cardInfo.startSerialNo, cardInfo.transferSize, cardInfo.username
        ];

        db.mysql.query(queries.setCardOwnershipTransferRecord, replacements, function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            data.ownershipTransferId = results.insertId;
            data.status = 'Pending';

            return callback();
        });
    },
    updateCardOwnershipTransferStatus: updateCardOwnershipTransferStatus,
    transferCardsOwnership: function (cardInfo, data, callback) {
        let connection;

        async.series([
            callback => {
                db.mysql.getConnection((err, conn) => {
                    if (err) {
                        return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                    }

                    connection = conn;
                    callback();
                });
            },
            callback => {
                connection.beginTransaction(function (err) {
                    if (err) {
                        return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                    }

                    return callback();
                });
            },
            callback => {
                updateCardOwnershipTransferStatus(cardInfo.ownershipTransferId, 1, cardInfo.remarks, cardInfo.username, callback, connection);
            },
            callback => {
                connection.query(queries.transferCardsOwnership,
                    [cardInfo.assignedTo, cardInfo.assignedBy, cardInfo.username, cardInfo.startSerialNo, cardInfo.endSerialNo],
                    function (err, results, fields) {
                        if (err) {
                            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                        }

                        data.transferredCards = results.affectedRows;
                        callback();
                    });
            },
            callback => {
                connection.commit((err) => {
                    if (err) {
                        return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                    }

                    return callback();
                });
            }
        ], err => {
            if (err && connection) {
                return connection.rollback(function () {
                    connection.release();
                    return callback(err);
                });
            }

            if (err) {
                return callback(err);
            }

            if (connection) {
                connection.release();
            }

            return callback();
        });
    },
    retrieveCardInfo: function (hrn, cardInfo, callback) {
        retrieveCardInfoUsingSpecificPartition(hrn, cardInfo, callback);
    },
    retrieveCardInfoWithPromo: function (hrn, cardInfo, callback) {
        db.mysql.query(queries.cardInfoWithPromo, [hrn], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            if (results.length === 0) {
                return callback(resGen.responseGenerator(resGen.NOT_FOUND, `No card information found for pin[${hrn}]`, resDet.INVALID_PIN));
            }

            if (results[0].status === 0) {
                return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, `Card is not active for pin[${hrn}]`, resDet.INACTIVE_PIN));
            }

            if (results[0].status === 2) {
                return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, `Card is used for pin[${hrn}]`, resDet.USED_PIN));
            }

            if (moment(results[0].expiryDate).toDate().getTime() < new Date().getTime()) {
                return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, `Card expired for pin[${hrn}]`, resDet.EXPIRED_PIN));
            }

            if (results[0].activeValueType !== 0) {
                results[0].amount = -1;
                results[0].salesAmount = -1;
                results[0].currencyId = -1;
            }

            Object.assign(cardInfo, results[0]);
            return callback();
        });
    },
    retrieveCardInfoWithoutCheck: function (serialNo, pin, cardInfo, callback) {
        async.series([
            callback => {
                if (!serialNo) return callback();
                retrieveCardInfoUsingSerialNo(serialNo, cardInfo, callback);
            },
            callback => {
                if (serialNo) return callback();
                retrieveCardInfoForCheck(pin, cardInfo, callback);
            }
        ], err => {
            if (err) {
                return callback(err);
            }

            callback();
        });
    },
    updateCardInfo: updateCardInfo,
    deleteCardInfo: function (serialNo, callback) {
        db.mysql.query(queries.deleteCardInfo, [serialNo], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            return callback();
        });
    },
    redoCardInfo: function (context, callback) {
        let query = queries.redoCardInfo;
        if (config.redoCardStatus && config.redoCardStatus === 2) {
            query = queries.redoCardStatus;
        }

        let replacements = [config.redoCardStatus, context.updatedBy, context.serialNo];
        db.mysql.query(query, replacements, function (err, results, fields) {
            if (err || results.affectedRows === 0) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            return callback();
        });
    },
    generateOnDemandCard: function (context, cardInfo, callback) {
        db.mysql.query(queries.onDemandCard, [context.productId, context.amount, context.createdBy, context.channel, context.hrnGeneratorSQL],
            function (err, results, fields) {
                if (err || results.length < 1 || results[0].length < 1) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                }

                let result = results[0][0];
                if (result.error_occured === 1) {
                    return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, result.error_description, result.error_code));
                }

                delete result.error_occured;
                delete result.error_code;
                delete result.error_description;

                Object.assign(cardInfo, result);
                return callback();
            });
    },
    checkForCardSerialInterval: function (startSerialNo, transferSize, callback) {
        let replacements = [transferSize, startSerialNo, (startSerialNo + transferSize - 1)];

        db.mysql.query(queries.checkCardSerialInterval, replacements, function (err, results, fields) {
            if (err || results.length < 1) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            if (results[0].matched === 0) {
                return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, 'Information not available in the system for the given number of cards'));
            }

            return callback();
        });
    },
    checkForAnyPendingTransfer: function (startSerialNo, endSerialNo, callback, message) {
        db.mysql.query(queries.checkForAnyPendingTransfer, [endSerialNo, startSerialNo, endSerialNo, startSerialNo],
            function (err, results, fields) {
                if (err || results.length < 1) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                }

                if (results[0].allowed === 0) {
                    message = message || 'These cards already transferred and user is yet to accept/reject';
                    return callback(resGen.responseGenerator(resGen.ACTION_NOT_SUPPORTED_ERR, message));
                }

                return callback();
            });
    },
    fetchCardTransferInfo: function (filters, data, callback) {
        let columns = [
            'cot.card_ownership_transfer_id', 'cot.card_ownership_transfer_type', 'cot.card_ownership_transfer_from',
            'cot.card_ownership_transfer_to', 'cot.card_ownership_transfer_status', 'cot.creation_date', 'cot.creation_date'
        ];
        let values = [
            filters.ownershipTransferId, filters.transferType, filters.assignedBy, filters.assignedTo,
            filters.status, filters.startDate, filters.endDate
        ];
        let operators = ['=', '=', '=', '=', '=', '>=', '<='];

        let condition = utils.generateDynamicWhereCondition(columns, values, operators);
        db.mysql.query(queries.fetchCardTransferInfo(condition.whereCondition), condition.replacements,
            function (err, results, fields) {
                if (err) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                }

                if (results.length === 0 && filters.ownershipTransferId) {
                    return callback(resGen.responseGenerator(resGen.NOT_FOUND, 'Incorrect ownership transfer id'));
                }

                data.push(...results);
                callback();
            });
    },
    fetchCardsInfo: function (lotId, data, callback) {
        let encryptionKey;
        data.push({ fields: [], values: [] });

        async.series([
            callback => {
                db.mysql.query(queries.fetchEncryptionKey, [], function (err, results, fields) {
                    if (err || results.length === 0) {
                        return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                    }

                    encryptionKey = results[0].encryptionKey;
                    callback();
                });
            },
            callback => {
                let error = false;
                let process = db.mysql.query(queries.fetchCardsInfo, [encryptionKey, lotId]);

                process
                    .on('error', function (err) {
                        error = true;
                        return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                    })
                    .on('fields', function (fields) {
                        for (let index in fields) {
                            data[0].fields.push(fields[index].name);
                        }
                    })
                    .on('result', function (row) {
                        let rowData = [];
                        for (let index in data[0].fields) {
                            rowData.push(row[data[0].fields[index]]);
                        }
                        data[0].values.push(rowData);
                    })
                    .on('end', function () {
                        if (!error) {
                            return callback();
                        }
                    });
            }
        ], err => {
            if (err) {
                return callback(err);
            }

            return callback();
        });
    },
    redeemCard: function ({ pin, channel, mobileNo, referenceId, validProducts, returnInOriginalCurrency, usedBy }, data, callback) {
        let cardInfo = {};
        let currencyInfo = [];
        let productIdsEachLot = [];

        let convertedAmount;
        async.series([
            callback => {
                retrieveCardInfoUsingSpecificPartitionForDialer(pin, cardInfo, callback);
            },
            callback => {
                retrieveAllProductIdAgainstALot(cardInfo.lotId, productIdsEachLot, callback);
            },
            callback => {
                productIdsEachLot.push(cardInfo.productId);
                if (!validProducts.some((validProductId) => productIdsEachLot.includes(validProductId))) {
                    return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, `This card cannot be used for ${usedBy}`));
                }
                currency.retrieveCurrencyList({ currencyId: cardInfo.currencyId }, currencyInfo, callback);

            },
            callback => {

                currencyInfo = currencyInfo[0];

                if (!returnInOriginalCurrency) {
                    convertedAmount = utils.roundAmount(
                        (Number(cardInfo.amount) / Number(currencyInfo.currencyConversionRate)),
                        config.roundamount.ceil
                    );
                }

                updateCardInfo({
                    status: 2,
                    partition: cardInfo.partition,
                    serialNo: cardInfo.serialNo,
                    channel: channel,
                    orderdBy: 0,
                    orderDate: 'NOW()',
                    updatedBy: usedBy
                }, callback);
            },
            callback => {
                order.keepExecutionHistory({
                    clientTrxId: referenceId,
                    executionType: utils.executionType.SCRATCH_CARD,
                    productId: cardInfo.productId,
                    amount: cardInfo.amount,
                    salesAmount: cardInfo.salesAmount,
                    currencyId: cardInfo.currencyId,
                    mobileNo: mobileNo,
                    channel: channel,
                    createdBy: usedBy,
                    serialNo: cardInfo.serialNo
                }, callback);
            },
            callback => {
                data['amount'] = convertedAmount;
                data['currency'] = returnInOriginalCurrency ? currencyInfo['currencyName'] : 'MYR';

                callback();
            }
        ], (err) => {
            if (err) {
                return callback(err);
            }

            callback();
        });
    },
    redeemCardStatus: function ({ pin, validProducts, returnInOriginalCurrency }, data, callback) {
        let cardInfo = {};
        let currencyInfo = [];
        let productIdsEachLot = [];

        async.series([
            callback => {
                retrieveCardInfoUsingSpecificPartitionForCheck(pin, cardInfo, callback);
            },
            callback => {
                retrieveAllProductIdAgainstALot(cardInfo.lotId, productIdsEachLot, callback);
            },
            callback => {
                productIdsEachLot.push(cardInfo.productId);
                if (!validProducts.some((validProductId) => productIdsEachLot.includes(validProductId))) {
                    return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, 'Invalid Pin number'));
                }

                currency.retrieveCurrencyList({ currencyId: cardInfo.currencyId }, currencyInfo, callback);
            },
            callback => {
                currencyInfo = currencyInfo[0];

                if (!returnInOriginalCurrency) {
                    cardInfo.amount = utils.roundAmount(
                        (Number(cardInfo.amount) / Number(currencyInfo.currencyConversionRate)),
                        config.roundamount.ceil
                    );
                }

                data['serial'] = cardInfo.serialNo;
                data['status'] = (cardInfo.status === 2) ? 'Used' : (cardInfo.status === 1 ? 'Free' : 'Inactive');
                data['amount'] = cardInfo.amount;
                data['currency'] = returnInOriginalCurrency ? currencyInfo['currencyName'] : 'MYR';

                callback();
            }
        ], (err) => {
            if (err) {
                return callback(err);
            }

            callback();
        });
    },
    retrieveCardInfoForImpact, retrieveCardStatisticForImpact
};
