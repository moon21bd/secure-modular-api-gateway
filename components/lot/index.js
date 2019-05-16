'use strict';

const async    = require('async');

const product  = require('../../components/product');

const db       = require('../../resources/database.connection');
const resGen   = require('../../lib/result.codes');
const resDet   = require('../../lib/result.details');
const util     = require('../../lib/utils');
const cfg      = require('../../config');

const queries  = require('./queries');

function updateLotInfo(lotInfo, callback, connection) {
    let replacements = [
        lotInfo.lotName, lotInfo.lotName, lotInfo.productId, lotInfo.productId, lotInfo.packageId, lotInfo.packageId,
        lotInfo.noOfCards, lotInfo.noOfCards, lotInfo.cardValue, lotInfo.cardValue, lotInfo.salesValue, lotInfo.salesValue,
        lotInfo.activeValueType, lotInfo.activeValueType, lotInfo.currencyId, lotInfo.currencyId, lotInfo.status,
        lotInfo.status, lotInfo.validationPeriod, lotInfo.validationPeriod, lotInfo.validationPeriod, lotInfo.updatedBy, lotInfo.lotId,
        lotInfo.productId, lotInfo.packageId
    ];
    connection = connection ? connection : db.mysql;

    connection.query(queries.updateLotInfo, replacements,
        function(err, results, fields) {
            if (err && err.code === 'ER_NO_REFERENCED_ROW_2') {
                return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, undefined, resDet.LOT_UPDATE_FAILED));
            }

            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            if (results.affectedRows <= 0) {
                return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, undefined, resDet.LOT_UPDATE_FAILED));
            }

            callback();
        });
}

function updateAllCardInfo(lotInfo, callback, connection) {
    let replacements = [
        lotInfo.cardValue, lotInfo.cardValue, lotInfo.salesValue, lotInfo.salesValue, lotInfo.activeValueType, lotInfo.activeValueType,
        lotInfo.validationPeriod, lotInfo.validationPeriod, lotInfo.validationPeriod, lotInfo.updatedBy, lotInfo.lotId
    ];
    connection = connection ? connection : db.mysql;

    connection.query(queries.updateCardsUnderSpecificLot, replacements,
        function(err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR));
            }

            lotInfo.updatedCards = results.affectedRows;
            callback();
        });
}

function updateLotDetailsInfo(details) {
    for (let index in details) {
        let detail = details[index];

        let convertedStartSerial = Number(detail.startSerial);
        if (!isNaN(convertedStartSerial)) {
            detail.startSerial = convertedStartSerial;
        }

        detail.isPackage = detail.isPackage === '1';

        switch (detail.activeValueType) {
            case 0:
                detail.lotValues = [{ name: '', cardValue: detail.cardValue }];
                break;
            case 1:
                detail.lotValues = [{ name: detail.name, cardValue: detail.cardValue }];
                break;
            case 2:
                let parts = detail.lotValues ? detail.lotValues.split(',') : [];
                detail.lotValues = [];
                for (let index in parts) {
                    let valueParts = parts[index].split('|');
                    detail.lotValues.push({ name: valueParts[0], cardValue: Number(valueParts[1]) })
                }
                break;
        }

        let addOnsParts = detail.addOns ? detail.addOns.split('$') : [];
        detail.addOns = [];
        for (let index in addOnsParts) {
            let addOnParts = addOnsParts[index].split('.');
            if (addOnParts.length < 3) continue;

            let isPackage = addOnParts[0] === '1';
            let id = Number(addOnParts[1]);
            let name = addOnParts[2];
            if (id && name) {
                detail.addOns.push({
                    isPackage: isPackage,
                    id: id,
                    name: name
                });
            }
        }

        delete detail.cardValue;

        let convertedEndSerial = Number(detail.endSerial);
        if (!isNaN(convertedEndSerial)) {
            detail.endSerial = convertedEndSerial;
        }
    }
}

module.exports = {
    mergeLotProductInfo: function (lotId, productId, packageId, createdBy, addOns) {
        let lotProductInfo = {
            lotId: lotId,
            add: [],
            del: [],
            deletableProducts: [ 0 ],
            deletablePackages: [ 0 ],
            products: productId ? [productId] : [],
            packages: packageId ? [packageId] : []
        };

        if (!addOns) return lotProductInfo;

        for (let i = 0; i < addOns.length; i++) {
            let addOn = addOns[i];

            if (addOn.action !== undefined && addOn.action === 0) {
                lotProductInfo.del.push([addOn.productId, addOn.packageId]);
                if (addOn.productId) {
                    lotProductInfo.deletableProducts.push(addOn.productId);
                }

                if (addOn.packageId) {
                    lotProductInfo.deletablePackages.push(addOn.packageId);
                }

                continue;
            }

            if (addOn.productId && addOn.productId === productId) continue;
            if (addOn.packageId && addOn.packageId === packageId) continue;

            lotProductInfo.add.push([lotId, addOn.productId, addOn.packageId, createdBy]);

            if (addOn.productId) lotProductInfo.products.push(addOn.productId);
            if (addOn.packageId) lotProductInfo.packages.push(addOn.packageId);
        }

        return lotProductInfo;
    },
    createLotInfo: function (lotInfo, callback) {
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
                let replacements = [
                    lotInfo.lotId, lotInfo.lotName, lotInfo.productId, lotInfo.packageId, lotInfo.noOfCards, lotInfo.cardValue, lotInfo.salesValue,
                    lotInfo.activeValueType, lotInfo.currencyId, lotInfo.validationPeriod, lotInfo.validationPeriod, lotInfo.createdBy
                ];
                connection.query(queries.insertLotInfo, replacements, (err, results, fields) => {
                    if (err) {
                        return connection.rollback(function () {
                            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                        });
                    }

                    callback();
                });
            },
            callback => {
                if (lotInfo.addOns.add.length === 0) return callback();
                connection.query(queries.insertLotAddOn, [lotInfo.addOns.add], (err, results, fields) => {
                    if (err) {
                        return connection.rollback(function () {
                            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                        });
                    }

                    callback();
                });
            },
            callback => {
                connection.commit((err) => {
                    if (err) {
                        return connection.rollback(function () {
                            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                        });
                    }

                    return callback();
                });
            }
        ], err => {
            if (connection) {
                connection.release();
            }

            if (err) {
                return callback(err);
            }

            return callback();
        });
    },
    updateLotInfo: updateLotInfo,
    fetchLotInfo: function (filters, data, callback) {
        if (filters.startDate) {
            filters.startDate = util.changeToUtcDate(filters.startDate, filters.timezone, true);
        }
        filters.endDate = util.changeToUtcDate(filters.endDate, filters.timezone);

        if (!filters.startDate) filters.startDate = '1970-12-26 00:00:00';
        let replacements = filters.lotId ? [filters.lotId] : [filters.startDate, filters.endDate];

        db.mysql.query(filters.lotId ? queries.fetchSpecificLot : queries.fetchAllLot, replacements,
            function(err, results, fields) {
                if (err || results.length < 0) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                }

                if (filters.lotId && results.length === 0) {
                    return callback(resGen.responseGenerator(resGen.NOT_FOUND, undefined, resDet.NO_LOT_FOUND));
                }

                if (filters.lotId) {
                    let result = results[0];
                    let addOnList = result.addOnList ? result.addOnList.split('||') : [];
                    delete result.addOnList;
                    result.addOns = [];
                    for(let i = 0; i < addOnList.length; i++) {
                        let parts = addOnList[i].split('$');
                        if (parts.length < 7) continue;

                        result.addOns.push({
                            productId: Number(parts[0]),
                            productName: parts[1],
                            productCategory: parts[2],
                            productValue: Number(parts[3]),
                            productCurrency: parts[4],
                            productSalesValue: Number(parts[5]),
                            packageId: Number(parts[6])
                        });
                    }
                    data.push(result);

                    return callback();
                }

                util.forEachAsync(results, function(result) {
                    let addOnList = result.addOnList ? result.addOnList.split(',') : [];
                    delete result.addOnList;
                    result.addOns = [];
                    for(let i = 0; i < addOnList.length; i++) {
                        let parts = addOnList[i].split('.');
                        if (parts.length < 2 || (parts[0] === '0' && parts[1] === '0')) continue;

                        let isPackage = parts[0] === '0';
                        let id = isPackage ? parts[1] : parts[0];
                        result.addOns.push({ isPackage: isPackage, id: Number(id) });
                    }
                    data.push(result);
                }, callback);
            });
    },
    fetchOnlyLotInfo: function (lotId, lotInfo, callback) {
        db.mysql.query(queries.fetchOnlyLotInfo, [lotId], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            if (results.length === 0) {
                return callback(resGen.responseGenerator(resGen.NOT_FOUND, undefined, resDet.INVALID_LOT_ID));
            }

            Object.assign(lotInfo, results[0]);
            callback();
        });
    },
    verifyLotId: function (lotId, callback, container) {
        db.mysql.query(queries.verifyLotId, [lotId],
            function(err, results, fields) {
                if (err) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                }

                if (results.length === 0) {
                    return callback(resGen.responseGenerator(resGen.NOT_FOUND, undefined, resDet.INVALID_LOT_ID));
                }

                if (container) {
                    container.lotStatus = results[0].lotStatus;
                }
                callback();
            });
    },
    verifyIfLotUpdatePermissible: function (lotInfo, updatedFields, callback) {
        let keys = ['lotName', 'productId', 'packageId', 'noOfCards', 'currencyId'];
        if (lotInfo.lotStatus === 1 && keys.some((element, index, array) => element in updatedFields)) {
            return callback(resGen.responseGenerator(resGen.ACTION_NOT_SUPPORTED_ERR, 'In Provision mode, requested updated fields does not support'))
        }

        return callback();
    },
    checkIfLotProvisionHappening: function (lotId, callback) {
        db.mysql.query(queries.verifyIfLotIsInProvisioningState, [lotId],
            function(err, results, fields) {
                if (err) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                }

                if (results.length === 0) {
                    return callback();
                }

                if (results[0].logStatus === 0) {
                    return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, 'Provisioning is happening for lot id [' + lotId + ']', resDet.LOT_PROVISION_ACTIVE));
                }

                return callback();
            });
    },
    updateLotInfoWithAddOns: function (lotInfo, callback) {
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
                updateLotInfo(lotInfo, callback, connection);
            },
            callback => {
                if (lotInfo.addOns.add.length === 0) return callback();

                connection.query(queries.insertLotAddOn, [lotInfo.addOns.add, lotInfo.updatedBy], (err, results, fields) => {
                    if (err) {
                        return connection.rollback(function () {
                            return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, 'Duplicate Product/Package id', resDet.DUPLICATE_PRODUCT_ID));
                        });
                    }

                    callback();
                });
            },
            callback => {
                if (lotInfo.addOns.del.length === 0) return callback();

                connection.query(queries.deleteLotAddOn,
                    [lotInfo.lotId, lotInfo.addOns.deletableProducts, lotInfo.addOns.deletablePackages],
                    (err, results, fields) => {
                        if (err) {
                            return connection.rollback(function () {
                                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                            });
                        }

                        callback();
                });
            },
            callback => {
                connection.commit((err) => {
                    if (err) {
                        return connection.rollback(function () {
                            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                        });
                    }

                    return callback();
                });
            }
        ], err => {
            if (connection) {
                connection.release();
            }

            if (err) {
                return callback(err);
            }

            return callback();
        });
    },
    updateLotInfoWithCards: function (lotInfo, callback) {
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
                updateLotInfo(lotInfo, callback, connection);
            },
            callback => {
                updateAllCardInfo(lotInfo, callback, connection);
            },
            callback => {
                connection.commit((err) => {
                    if (err) {
                        return connection.rollback(function () {
                            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                        });
                    }

                    return callback();
                });
            }
        ], err => {
            if (connection) {
                connection.release();
            }

            if (err) {
                return callback(err);
            }

            return callback();
        });
    },
    checkProvisionLot: function (lotId, callback) {
        db.mysql.query(queries.checkProvisionLot, [lotId], function (err, results, fields) {
            if (err || results.length < 1 || results[0].length < 1) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            let info = results[0][0];
            if (info.error_occured === 1) {
                return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, info.error_description, info.error_code));
            }

            callback();
        });
    },
    provisionLot: function (lotId, provisionedBy, callback) {
        let eventIdExtension = Math.round(Math.random() * (100 - 1) + 1);
        db.mysql.query(queries.provisionLot, [parseInt(lotId), eventIdExtension, lotId, cfg.hrn_sql.generic, provisionedBy],
            function (err, results, fields) {
                if (err) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                }

                callback();
            });
    },
    lotProvisionStatus: function (lotId, data, callback) {
        db.mysql.query(queries.lotProvisionStatus, [lotId],
            function (err, results, fields) {
                if (err) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                }

                if (results.length === 0) {
                    return callback(resGen.responseGenerator(resGen.NOT_FOUND, 'No information found for lot id [' + lotId + ']', resDet.INVALID_LOT_ID));
                }

                data.push(results[0]);
                callback();
            });
    },
    verifyLotAddOn: function (lotId, addOn, callback) {
        if (!addOn.productId) {
            return callback();
        }

        addOn.lotId = lotId;
        product.verifyProductId(addOn.productId, (err) => {
            if (err && err.code === resGen.NOT_FOUND) {
                return callback(resGen.responseGenerator(resGen.NOT_FOUND, 'Product id[' + addOn.productId + '] is not supported', resDet.PRODUCT_ID_NOT_SUPPORTED));
            }

            if (err) {
                return callback(err);
            }

            return callback();
        });
    },
    fetchDetailLotInfo: function (filters, data, callback) {
        let startSerialNo = !filters.startSerialNo ? 0 : filters.startSerialNo;
        let lotId = filters.lotId;
        let cardLimitClause = !filters.limit ? '' : `LIMIT ${filters.limit}`;
        let lotLimitClause = !filters.batchSize ? '' : `LIMIT ${filters.batchSize}`;
        let purpose = filters.purpose || 0;
        let replacements = (purpose === 2 || purpose === 3) ?
            [ startSerialNo, lotId, lotId ] :
            [ startSerialNo, filters.status, lotId, lotId ];

        db.mysql.query(queries.lotDetailInfo(cardLimitClause, lotLimitClause, purpose),
            replacements,
            function (err, results, fields) {
                if (err) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                }

                updateLotDetailsInfo(results);
                data.push(...results);
                callback();
            }
        );
    },
    checkForUpdatableCards: function (lotId, data, callback) {
        db.mysql.query(queries.updatableCards, [lotId], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            if (results.length === 0 || results[0].nonUpdatableCards === null) {
                return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, 'Incorrect lot id'));
            }

            data.push({
                nonUpdatableCards: results[0].nonUpdatableCards,
                updatableCards: results[0].updatableCards
            });

            callback();
        });
    },
    fetchDetailLotInfoForSalesPortal: function (filters, data, callback) {
        let productId=filters.productId;
        let startSerialNo = !filters.startSerialNo ? 0 : filters.startSerialNo;
        let lotId = filters.lotId;
        let userId = filters.userId;
        let cardLimitClause = !filters.limit ? '' : `LIMIT ${filters.limit}`;
        let lotLimitClause = !filters.batchSize ? '' : `LIMIT ${filters.batchSize}`;
        let purpose = filters.purpose || 0;
        let replacements;
        switch (purpose) {
            case 0:
                replacements = [ startSerialNo, filters.status, productId ];
                break;
            case 1:
                replacements = [];
                break;
            case 2:
                replacements = [startSerialNo, productId, userId];
                break;
            case 3:
                replacements = [startSerialNo, productId];
                break;
            default:
                replacements = [ startSerialNo, filters.status, productId ];
                break;
        }


        db.mysql.query(queries.lotDetailInfoForSalesPortal(cardLimitClause, lotLimitClause, purpose),
            replacements,
            function (err, results, fields) {
                if (err) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                }

                updateLotDetailsInfo(results);
                data.push(...results);
                callback();
            }
        );
    }

};
