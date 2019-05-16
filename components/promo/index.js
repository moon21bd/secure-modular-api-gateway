'use strict';

const async     = require('async');

const db         = require('../../resources/database.connection');
const resGen     = require('../../lib/result.codes');

const queries    = require('./queries');

module.exports = {
    createPromoInfo: function ({ type, text, maskingText, startTime, endTime, username }, container, callback) {
        db.mysql.query(queries.createPromoInfo, [type, text, maskingText, startTime, endTime, username],
            function (err, results, fields) {
                if (err) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                }

                if (results.affectedRows <= 0) {
                    return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, 'Promo is not created'));
                }

                container.promoId = results.insertId;
                return callback();
            });
    },
    updatePromoInfo: function ({ promoId, type, text, maskingText, startTime, endTime, username }, callback) {
        db.mysql.query(queries.updatePromoInfo,
            [type, type, text, text, maskingText, maskingText, startTime, startTime, endTime, endTime, username, promoId],
            function (err, results, fields) {
                if (err) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                }

                if (results.affectedRows <= 0) {
                    return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, 'Promo is not updated'));
                }

                return callback();
            });
    },
    showPromoInfo: function (promoId, data, callback) {
        db.mysql.query(queries.showPromoInfo, [ promoId, promoId ],
            function (err, results, fields) {
                if (err) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                }

                if (results.length === 0 && promoId) {
                    return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, 'Promo is not found'));
                }

                data.push(...results);
                return callback();
            });
    },
    checkPromoInfo: function ({transactionId, mobileNumber, pin}, container, callback) {
        db.mysql.query(queries.checkPromoInfo, [pin, transactionId, '%' + mobileNumber + '%' ], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            if (results.length <= 0) {
                return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, 'Promo is not applicable'));
            }

            Object.assign(container, results[0]);

            return callback();
        });
    },
    setPromoUserInfo: function ({transactionId, promoId, userInput, serialNo, mobileNumber, username}, callback) {
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
                userInput = userInput.substr(0, 64);
                connection.query(queries.insertPromoUserInfo,
                    [promoId, userInput, serialNo, mobileNumber, username],
                    function (err, results, fields) {
                        if (err) {
                            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                        }

                        return callback();
                    });
            },
            callback => {
                connection.query(queries.updateExecutionHistory,
                    [userInput, username, transactionId],
                    function (err, results, fields) {
                        if (err) {
                            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                        }

                        return callback();
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
    }
};