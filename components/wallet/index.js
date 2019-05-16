"use strict"

const async = require("async")
const net = require("net")
const request = require("request")
const Joi = require("joi")
const moment = require("moment")
const uuidv1 = require("uuid/v1")
const xml = require("fast-xml-parser")

const currency = require("../currency")

const db = require("../../resources/database.connection")
const resGen = require("../../lib/result.codes")
const resDet = require("../../lib/result.details")
const utils = require("../../lib/utils")
const phoneIdentifier = require("../../lib/phonenumber")
const queries = require("./queries")
const engineProperties = require("../../resources/executionengine.properties")
const cfg = require("../../config")

function updateSoftPinInfo({ transactionRefId, serialNo, pin }, callback) {
    db.mysql.query(queries.updateSoftPinInfo, [pin, transactionRefId], (err, results, fields) => {
        if (err) {
            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
        }

        return callback()
    })
}

module.exports = {
    fetchWalletInfo: function ({ userId, walletTypeId }, container, callback) {
        db.mysql.query(queries.fetchWalletInfo, [userId, walletTypeId], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            if (results.length <= 0) {
                return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, "No such wallet exists For this User"))
            }

            Object.assign(container, results[0])
            return callback()
        })
    },
    fetchAllWalletInfo: function (userId, container, callback) {
        db.mysql.query(queries.fetchAllWalletInfo, [userId, userId], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            container.push(...results)
            return callback()
        })
    },
    balanceAdd: function (inputData, data, callback) {
        let channel = !inputData.channel ? "" : inputData.channel
        let requestedBy = !inputData.requestedBy ? "" : inputData.requestedBy
        console.log(inputData.userId, inputData.amount, inputData.currencyId, inputData.walletTypeId, 1, "", "")
        db.mysql.query(
            queries.addWalletBalance,
            [inputData.userId, inputData.amount, inputData.currencyId, inputData.walletTypeId, 3, channel, requestedBy],
            function (err, results, fields) {
                if (err || results.length <= 0) {
                    console.log(err)
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                }
                let resultData = JSON.parse(JSON.stringify(results[0]))

                Object.keys(resultData[0]).forEach(key => (data[key] = resultData[0][key]))
                delete data.error_occurred
                delete data.error_occurred
                delete data.result_description
                return callback()
            }
        )
    },
    balanceAddForB2bServices: function (inputData, userInfo, data, callback) {
        let channel = !inputData.channel ? "" : inputData.channel
        let requestedBy = !inputData.requestedBy ? "" : inputData.requestedBy
        console.log(userInfo.userId, inputData.amount, inputData.currencyId, inputData.walletTypeId, 1, "", "")
        db.mysql.query(
            queries.addWalletBalance,
            [userInfo.userId, inputData.amount, inputData.currencyId, inputData.walletTypeId, 3, channel, requestedBy],
            function (err, results, fields) {
                if (err || results.length <= 0) {
                    console.log(err.code /*ER_NO_REFERENCED_ROW_2*/)
                    if (err.code === "ER_NO_REFERENCED_ROW_2") {
                        return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, "No such wallet exists For this User"))
                    } else {
                        return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                    }
                }
                let resultData = JSON.parse(JSON.stringify(results[0]))

                Object.keys(resultData[0]).forEach(key => (data[key] = resultData[0][key]))
                delete data.error_occurred
                delete data.error_occurred
                delete data.result_description
                return callback()
            }
        )
    },
    checkWalletIdAgainstProductAndUserId: function (filters, container, callback) {
        let query =
            'SELECT cw.wallet_type_id AS walletTypeId, platform_currency_convertion(?, cw.wallet_balance, "-1") AS walletBalance,' +
            "cwt.wallet_type_name AS walletTypeName," + "ui.user_mobileno AS mobileNo " +
            "FROM platform_wallet cw " +
            "LEFT JOIN platform_wallet_type cwt ON cwt.wallet_type_id = cw.wallet_type_id " +
            "LEFT JOIN platform_users AS ui ON cw.wallet_user_id = ui.user_id " +
            "WHERE cw.wallet_user_id = ? AND cw.wallet_type_id = ?"
        if (filters.walletTypeIds) {
            query += " AND cw.wallet_type_id IN (" + filters.walletTypeIds + ")"
        }
        
        console.log("checkWalletIdAgainstProductAndUserId-QUERY", query);

        db.mysql.query(query, [filters.userId, filters.userId, filters.walletTypeId], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            if (results.length <= 0) {
                return callback(resGen.responseGenerator(resGen.ACTION_NOT_SUPPORTED_ERR, "Provided wallet info is not available"))
            }

            Object.assign(container, results[0])
            return callback()
        })
    },
    getUserPaymentMethodInfo: function (userId, paymentMethodId, paymentMethodInfo, callback) {
        async.series(
            [
                callback => {
                    db.mysql.query(queries.getUserPaymentMethods, [userId, paymentMethodId], function (err, results, fields) {
                        if (err) {
                            console.log("db query error is ", err)
                            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                        }
                        Object.assign(paymentMethodInfo, results[0])
                        callback()
                    })
                }
            ],
            err => {
                if (err) {
                    return callback(err)
                }

                callback()
            }
        )
    },
    digiWalletLimitProcess: function (userId, digiWalletInfo, callback) {
        async.series(
            [
                callback => {
                    db.mysql.query(queries.getUserPaymentMethods, [userId, 1], function (err, results, fields) {
                        if (err) {
                            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                        }
                        Object.assign(digiWalletInfo, results[0])

                        callback()
                    })
                },
                callback => {
                    if (!digiWalletInfo.id) {
                        db.mysql.query(queries.createtUserPaymentMethods(), [userId, 1], function (err, results, fields) {
                            if (err) {
                                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                            }
                            callback()
                        })
                    } else {
                        db.mysql.query(queries.updateUserPaymentMethods(), [userId, 1], function (err, results, fields) {
                            if (err) {
                                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                            }
                            callback()
                        })
                    }
                }
            ],
            err => {
                if (err) {
                    return callback(err)
                }

                callback()
            }
        )
    },
    partnerBWalletLimitProcess: function (userId, digiWalletInfo, callback) {
            async.series(
                [
                    callback => {
                        db.mysql.query(queries.getUserPaymentMethods, [userId, 1], function (err, results, fields) {
                            if (err) {
                                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                            }
                            Object.assign(digiWalletInfo, results[0])

                            callback()
                        })
                    },
                    callback => {
                        if (!digiWalletInfo.id) {
                            db.mysql.query(queries.createtUserPaymentMethods(), [userId, 1], function (err, results, fields) {
                                if (err) {
                                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                                }
                                callback()
                            })
                        } else {
                            db.mysql.query(queries.updateUserPaymentMethods(), [userId, 1], function (err, results, fields) {
                                if (err) {
                                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                                }
                                callback()
                            })
                        }
                    }
                ],
                err => {
                    if (err) {
                        return callback(err)
                    }

                    callback()
                }
            )
        },

    fetchPartnerUsageLimitConfiguration: function (callback) {
        const PARTNER_PM_ID = 1;
        async.series(
            [
                callback => {
                    db.mysql.query(queries.fetchPartnerUsageLimitConfiguration, [], function (err, results, fields) {
                        if (err || results.length === 0) {
                            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                        }

                        Object.assign(global, { digiUsageLimitInfo: results[0] })

                        callback()
                    })
                }
            ],
            err => {
                if (err) {
                    return callback(err)
                }

                callback()
            }
        )
    },

    getProductPaymentMethods: function (userId, productId, paymentMethodInfo, callback) {
        console.log("getProductPaymentMethods queries.getProductPaymentMethods: ", userId, productId, queries.getProductPaymentMethods)
        async.series(
            [
                callback => {
                    db.mysql.query(queries.getProductPaymentMethods, [userId, productId], function (err, results, fields) {
                        if (err) {
                            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                        }
                        paymentMethodInfo.push(...results)
                        callback()
                    })
                }
            ],
            err => {
                if (err) {
                    return callback(err)
                }

                callback()
            }
        )
    },

    changeUserPaymentMethodData: function (amount, userId, paymentId, paymentMethodInfo, callback) {
        async.series(
            [
                callback => {
                    db.mysql.query(queries.changeUserPaymentMethodData, [amount, userId, paymentId], function (err, results, fields) {
                        if (err) {
                            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                        }
                        callback()
                    })
                }
            ],
            err => {
                if (err) {
                    return callback(err)
                }

                callback()
            }
        )
    },

    getWalletOperatorCharge: function (argu, walletChargePercentage, callback) {
        db.mysql.query(queries.getWalletOperatorCharge, [argu.walletTypeId, argu.operator, argu.configId], function (err, results, fields) {
            if (err || results.length == 0) {
                console.log("db query error is ", err)
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            if (results.length <= 0) {
                return callback(resGen.responseGenerator(resGen.NOT_FOUND, "No User-Info found"))
            }

            Object.assign(container, results[0])
            return callback()
        })
    },
    getWalletOperatorCharge: function (argu, walletChargePercentage, callback) {
        db.mysql.query(queries.getWalletOperatorCharge, [argu.walletTypeId, argu.operator, argu.configId], function (err, results, fields) {
            if (err || results.length == 0) {
                console.log("db query error is ", err)
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }
            Object.assign(walletChargePercentage, results[0])
            console.log("walletChargePercentage is", walletChargePercentage)

            return callback()
        })
        // let percentage = .25;
        // return percentage;
    }
}
