'use strict';

const async = require('async');

const db = require('../../resources/database.connection');
const queries = require('./queries');
const resGen = require('../../lib/result.codes');
const resDet = require('../../lib/result.details');
const utils = require('../../lib/utils');
const config = require('../../config');

function convertProductInfo(productInfo) {
    delete productInfo.commissionRateAmount;
    delete productInfo.commissionRateApplicablity;
    productInfo.productValue = parseFloat(parseFloat(productInfo.productValue).toFixed(2));
    productInfo.productSalesValue = parseFloat(parseFloat(productInfo.productSalesValue).toFixed(2));
    productInfo.productMinimumValue = parseFloat(parseFloat(productInfo.productMinimumValue).toFixed(2));
    productInfo.productMaximumValue = parseFloat(parseFloat(productInfo.productMaximumValue).toFixed(2));
    productInfo.isComissionApplicable = productInfo.isComissionApplicable === 1;
    productInfo.isDiscountApplicable = productInfo.isDiscountApplicable === 1;
    productInfo.currencyConversionRate = parseFloat(productInfo.currencyConversionRate);
    productInfo.reference8 = JSON.parse(productInfo.reference8 || null);

    let probableAmounts = [];
    if (productInfo.probableAmounts) {
        productInfo.probableAmounts.split('|').forEach((amount) => {
            amount = parseFloat(amount);
            probableAmounts.push({
                valueInProductCurrency: parseFloat(amount.toFixed(2)),
                valueInBaseCurrency: parseFloat((amount / productInfo.currencyConversionRate).toFixed(2))
            });
        });
    }
    productInfo.probableAmounts = probableAmounts;
}
function convertProductInfoForThirdParty(productInfo) {

    productInfo.productValue = parseFloat(parseFloat(productInfo.productValue).toFixed(2));
    productInfo.productSalesValue = parseFloat(parseFloat(productInfo.productSalesValue).toFixed(2));

    let productCharges = productInfo.productSalesValueWithCommissionAndCharge;
    let productSalesValWithCommNCharge = 0
    let productChargeRate = 0
    if (productCharges) {
       let productChargesArr = productCharges.split("|");
        productSalesValWithCommNCharge = parseFloat(productChargesArr[0])
        productChargeRate = parseFloat(productChargesArr[1])
    }

    productInfo.productSalesValueWithCommissionAndCharge = productSalesValWithCommNCharge;
    productInfo.productChargeRate = productChargeRate;
    productInfo.productMinimumValue = parseFloat(parseFloat(productInfo.productMinimumValue).toFixed(2));
    productInfo.productMaximumValue = parseFloat(parseFloat(productInfo.productMaximumValue).toFixed(2));
    productInfo.isComissionApplicable = productInfo.isComissionApplicable === 1;
    productInfo.isDiscountApplicable = productInfo.isDiscountApplicable === 1;
    productInfo.currencyConversionRate = parseFloat(productInfo.currencyConversionRate);

    let probableAmounts = [];
    if (productInfo.probableAmounts) {
        productInfo.probableAmounts.split('|').forEach((amount) => {
            amount = parseFloat(amount);
            let valueInBaseCurrencyAfterCommissionCalc = calculateValueAfterCommssion(amount, productInfo.currencyConversionRate, productInfo.commissionRateAmount, productInfo.commissionRateApplicablity)
            console.log('test currecncy:', valueInBaseCurrencyAfterCommissionCalc)
            let probableChargeCalculate = calculateProductCharges(productChargeRate, valueInBaseCurrencyAfterCommissionCalc)
            probableAmounts.push({
                valueInProductCurrency: parseFloat(amount.toFixed(2)),
                valueInBaseCurrency: parseFloat((amount / productInfo.currencyConversionRate).toFixed(2)),
                valueInBaseCurrencyAfterCommission: Math.floor(valueInBaseCurrencyAfterCommissionCalc * 100) / 100, // will show 2 values after decimal. 
                productChargeRate : productChargeRate,
                productSalesValueWithCommissionAndCharge : probableChargeCalculate
            });

            console.log('probableAmount in the console : ', probableAmounts)
        });
    }
    delete productInfo.commissionRateAmount;
    delete productInfo.commissionRateApplicablity;
    productInfo.probableAmounts = probableAmounts;
}
function calculateValueAfterCommssion(amount, currencyConversionRate, commissionRate, isApplicable) {
    if (isApplicable === 1) {
        return (amount - (amount * commissionRate) / 100) / currencyConversionRate;
    } else if (isApplicable === 0) {
        return (amount / currencyConversionRate) - commissionRate;
    }
    else {
        return (amount / currencyConversionRate)
    }

}

function calculateProductCharges(productChargeRate, productPriceWOCommision) {
    let productChargeFinal = productPriceWOCommision + (productPriceWOCommision * productChargeRate / 100)
    return parseFloat(parseFloat(productChargeFinal)).toFixed(2)
}

function retrieveProductInformationUsingId(productId, data, callback) {
    db.mysql.query(queries.productInfoUsingId, [productId], function (err, results, fields) {
        if (err) {
            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
        }

        if (results.length === 0) {
            return callback(resGen.responseGenerator(resGen.NOT_FOUND, 'Product info with id[' + productId + '] does not exist', resDet.NO_PRODUCT_FOUND));
        }

        Object.assign(data, results[0]);

        callback();
    });
}

module.exports = {
    getProductInfoUsingRefName: function (filters, container, callback) {
        let replacements = [
            filters.productName, filters.productName, filters.categoryId, filters.operator, filters.operator
        ];

        db.mysql.query(queries.productInfoUsingRefName, replacements, function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            if (results.length === 0) {
                return callback(resGen.responseGenerator(resGen.NOT_FOUND, `No product info found for [${filters.productName}]`, resDet.NO_PRODUCT_FOUND));
            }

            let info = results[0];
            if (info.status === 0) {
                return callback(resGen.responseGenerator(resGen.NOT_FOUND, `Product [${filters.productName}] is not active`, resDet.INACTIVE_PRODUCT));
            }

            Object.assign(container, info);
            return callback();
        });
    },
    retrieveProductCategoryInfo: function (productCategoryId, data, callback) {
        productCategoryId = productCategoryId || 0;
        db.mysql.query(queries.productCategoryInfo, [productCategoryId, productCategoryId], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            if (results.length === 0 && productCategoryId !== 0) {
                return callback(resGen.responseGenerator(resGen.NOT_FOUND, 'Incorrect product category id', resDet.NO_PRODUCT_CATEGORY_INFO));
            }

            data.push(...results);
            callback();
        });
    },
    retrieveProductAuthInfo: function (userId, productCategoryId, data, callback) {
        db.mysql.query(queries.productAuthInfo, [userId, productCategoryId], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            if (results.length === 0) {
                return callback(resGen.responseGenerator(resGen.NOT_FOUND, undefined, resDet.NO_PRODUCT_AUTH));
            }

            const userSettings = results[0];
            data.categoryId = productCategoryId;
            data.categoryName = userSettings.categoryName;
            data.passwordAuthentication = userSettings.passwordAuthentication === 1;
            data.emailAuthentication = userSettings.emailAuthentication === 1;

            callback();
        });
    },
    validateAuthenticationInformation: function (updatedFields, callback) {
        if (updatedFields.fundTransferPasswordAuthentication
            && updatedFields.fundTransferEmailAuthentication) {
            return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, 'Both type of authentication can not be enabled at the same time for point-transfer', resDet.AUTH_FUND_TRANSFER));
        }

        if (!updatedFields.productAuthentication || updatedFields.productAuthentication.length === 0) {
            return callback();
        }

        updatedFields.productAuthentication.forEach((authInfo, index) => {
            if (authInfo.passwordAuthentication && authInfo.emailAuthentication) {
                return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, 'Both type of authentication can not be enabled at the same time for category id [' + authInfo.categoryId + ']', resDet.AUTH_PRODUCT_CATEGORY));
            }

            if (index === (updatedFields.productAuthentication.length - 1)) {
                return callback();
            }
        });
    },
    retrieveProductInformation: function (filters, data, callback) {

        let condition = utils.generateDynamicWhereCondition([
            'pi.product_id', 'pc.category_id', 'c.currency_country_code', 'pi.product_status',
            'pc.category_status', 'c.currency_status', 'pi.product_currency_id', 'pi.product_reference_1', 'pi.product_offer'
        ], [filters.productId, filters.categoryId, filters.countryCode, 1, 1, 1, filters.currencyId, filters.operator, !filters.productOffer ? 0 : filters.productOffer]);
        let query = filters.needCommissionCalculation ?
            queries.productInfoWithCommission(condition.whereCondition, filters.roleId) :
            queries.productInfo(condition.whereCondition);
        db.mysql.query(query, condition.replacements, function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            results.forEach((product) => {
                convertProductInfo(product);
                data.push(product);
            });

            callback();
        });
    },
    retrieveProductInformationInUserCurrency: function (filters, userId, data, callback) {

        let condition = utils.generateDynamicWhereCondition([
            'pi.product_id', 'pc.category_id', 'c.currency_country_code', 'pi.product_status',
            'pc.category_status', 'c.currency_status', 'pi.product_currency_id', 'pi.product_reference_1', 'pi.product_offer'
        ], [filters.productId, filters.categoryId, filters.countryCode, 1, 1, 1, filters.currencyId, filters.operator, !filters.productOffer ? 0 : filters.productOffer]);
        let query = filters.needCommissionCalculation ?
            queries.productInfoWithCommissionInUserCurrency(condition.whereCondition, filters.roleId, userId) :
            queries.productInfoInUserCurrency(condition.whereCondition, userId);

        db.mysql.query(query, condition.replacements, function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            results.forEach((product) => {
                convertProductInfo(product);
                data.push(product);
            });

            callback();
        });
    },

    retrieveProductInformationForThirdParty: function (filters, data, callback) {
        
        let condition = utils.generateDynamicWhereCondition([
            'pi.product_id', 'pc.category_id', 'c.currency_country_code', 'pi.product_status',
            'pc.category_status', 'c.currency_status', 'pi.product_currency_id', 'pi.product_reference_1'
        ], [filters.productId, filters.categoryId, filters.countryCode, 1, 1, 1, filters.currencyId, filters.operator]);
        let query = filters.needCommissionCalculation ?
            queries.productInfoWithCommission(condition.whereCondition, filters.roleId, filters.channel) :
            queries.productInfo(condition.whereCondition, filters.channel);

        db.mysql.query(query, condition.replacements, function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            results.forEach((product) => {
                convertProductInfoForThirdParty(product);
                data.push(product);
            });

            callback();
        });
    },

    retrieveAllProductInformation: function (filters, data, callback) {
        let condition = utils.generateDynamicWhereCondition([
            'pi.product_id', 'pc.category_id', 'c.currency_country_code', 'pc.category_status', 'c.currency_status'
        ], [filters.productId, filters.categoryId, filters.countryCode, 1, 1]);

        db.mysql.query(queries.productInfo(condition.whereCondition), condition.replacements, function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            results.forEach((product) => {
                convertProductInfo(product);
                data.push(product);
            });

            callback();
        });
    },
    verifyMultipleProductIds: function (productIds, callback) {
        if (productIds.length === 0) return callback();

        db.mysql.query(queries.checkForMultipleProductIds, [productIds],
            function (err, results, fields) {
                if (err || results.length < 1) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                }

                if (results[0].counter !== productIds.length) {
                    return callback(resGen.responseGenerator(resGen.NOT_FOUND, 'Product(s) info not found', resDet.NO_PRODUCT_FOUND));
                }

                callback();
            });
    },
    verifyMultiplePackageIds: function (packageIds, callback) {
        if (packageIds.length === 0) return callback();

        db.mysql.query(queries.checkForMultiplePackageIds, [packageIds],
            function (err, results, fields) {
                if (err || results.length < 1) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                }

                if (results[0].counter !== packageIds.length) {
                    return callback(resGen.responseGenerator(resGen.NOT_FOUND, 'Package(s) info not found', resDet.NO_PACKAGE_INFO_FOUND));
                }

                callback();
            });
    },
    verifyProductId: function (productId, callback) {
        db.mysql.query(queries.checkProductId, [productId], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            if (results.length === 0) {
                return callback(resGen.responseGenerator(resGen.NOT_FOUND, 'Product info with id[' + productId + '] does not exist', resDet.NO_PRODUCT_FOUND));
            }

            callback();
        });
    },
    retrieveProductInformationUsingId: retrieveProductInformationUsingId,
    retrieveProductInformationForCardCheck: function (productId, data, callback) {
        db.mysql.query(queries.productInformationForCardCheck, [productId], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            if (results.length === 0) {
                return callback(resGen.responseGenerator(resGen.NOT_FOUND, 'Product info with id[' + productId + '] does not exist', resDet.NO_PRODUCT_FOUND));
            }

            data.productName = results[0].productName;
            data.productDescription = results[0].productDescription;

            callback();
        });
    },
    retrievePackageUsingId: function (packageId, callback) {
        db.mysql.query(queries.specificPackage, [packageId], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            if (results.length === 0) {
                return callback(resGen.responseGenerator(resGen.NOT_FOUND, 'Incorrect package id', resDet.NO_PACKAGE_INFO_FOUND));
            }

            callback(null, results[0]);
        });
    },
    retrievePackages: function (data, callback) {
        db.mysql.query(queries.allPackages, function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            data.push(...results);

            callback();
        });
    },
    retrieveProductInfoForPackage: function (packageId, data, callback) {
        db.mysql.query(queries.productInfoForPackage, [packageId], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            data.push(...results);
            callback();
        });
    },
    retrieveOrderInfo: function (filters, data, callback) {
        // lotId, packageId, productId, operator
        if (filters.packageId) {
            db.mysql.query(queries.orderInfoForPackage, [filters.packageId, filters.operator], function (err, results, fields) {
                if (err) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                }

                if (results.length === 0) {
                    return db.mysql.query(queries.orderInfoForPackageUsingOperator, [filters.lotId, filters.operator], function (err, results, fields) {
                        if (err) {
                            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                        }

                        if (results.length === 0) {
                            return callback(resGen.responseGenerator(resGen.NOT_FOUND, 'Package is currently unavailable. Please try later.'));
                        }

                        data.push(...results);
                        callback();
                    });
                }

                data.push(...results);
                callback();
            });
        } else {
            data.push({});
            db.mysql.query(queries.productInfoUsingOperator, [filters.productId, filters.operator], function (err, results, fields) {
                if (err) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                }

                if (results.length === 0) {
                    return db.mysql.query(queries.orderInfoForProductUsingOperator, [filters.lotId, filters.operator], function (err, results, fields) {
                        if (err) {
                            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                        }

                        if (results.length === 0) {
                            return callback(resGen.responseGenerator(resGen.NOT_FOUND, 'Product info with id[' + filters.productId + '] does not exist', resDet.NO_PRODUCT_FOUND));
                        }

                        Object.assign(data[0], results[0]);
                        callback();
                    });
                }

                Object.assign(data[0], results[0]);
                callback();
            });
        }
    },
    createProductInformation: function (input, container, callback) {
        let replacements = [
            input.productName, input.productDescription, input.productCategoryId, input.executionConfigId,
            input.productValue, input.productSalesValue, input.isComissionApplicable, input.hasVariableAmount,
            input.productMinimumValue, input.productMaximumValue, input.probableAmounts, input.isDiscountApplicable,
            input.productCurrencyId, input.productPic, input.reference1, input.reference2, input.reference3,
            input.reference4, input.reference5, input.reference6, input.reference7, input.createdBy
        ];

        db.mysql.query(queries.createProductInfo, replacements, function (err, results, fields) {
            if (err && err.code === 'ER_NO_REFERENCED_ROW_2') {
                return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, 'Incorrect product category id'));
            }

            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            container.productId = results.insertId;

            callback();
        });
    },
    updateProductInformation: function (updateData, callback) {
        let replacements = [
            updateData.productName, updateData.productName, updateData.productDescription, updateData.productDescription, updateData.productStatus,
            updateData.productStatus, updateData.productCategoryId, updateData.productCategoryId, updateData.productExecutionConfigId,
            updateData.productExecutionConfigId, updateData.productValue, updateData.productValue, updateData.productSalesValue, updateData.productSalesValue,
            updateData.isComissionApplicable, updateData.isComissionApplicable, updateData.hasVariableAmount, updateData.hasVariableAmount,
            updateData.productMinimumValue, updateData.productMinimumValue, updateData.productMaximumValue, updateData.productMaximumValue,
            updateData.probableAmounts, updateData.probableAmounts, updateData.isDiscountApplicable, updateData.isDiscountApplicable,
            updateData.productCurrencyId, updateData.productCurrencyId, updateData.productPic, updateData.productPic,
            updateData.reference1, updateData.reference1, updateData.reference2, updateData.reference2, updateData.reference3,
            updateData.reference3, updateData.reference4, updateData.reference4, updateData.reference5, updateData.reference5,
            updateData.reference6, updateData.reference6, updateData.reference7, updateData.reference7, updateData.updatedBy, updateData.productId
        ];

        db.mysql.query(queries.updateProductInfo, replacements, function (err, results, fields) {
            if (err) {
                if (err.sqlMessage.search('product_category_id') !== -1) {
                    return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, 'Incorrect product category id'));
                } else if (err.sqlMessage.search('product_execution_id') !== -1) {
                    return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, 'Incorrect product execution config id'));
                } else {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                }
            }

            callback();
        });
    },
    fetchMultipleProductsInfo: function (productsName, container, callback) {
        db.mysql.query(queries.fetchMultipleProductInfo, [productsName], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            results.forEach((result) => {
                container.productsInfo[result.productName] = result;
            });

            return callback();
        });
    },
    createProductRates: function (input, container, callback) {
        let replacements = [
            input.rateType, input.roleId, input.productId, input.appliedUserId,
            input.priority, input.rateApplicableType, input.rateAmount, input.createdBy
        ];

        db.mysql.query(queries.createProductRates, replacements, function (err, results, fields) {
            if (err && err.code === 'ER_DUP_ENTRY') {
                return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, 'This Commission Rate already exists'));
            }

            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            if (results.affectedRows === 0) {
                return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, 'Create operation failed. Please try again.'));
            }

            container.rateId = results.insertId;

            return callback();
        });
    },
    updateProductRates: function (updatedFields, callback) {
        let replacements = [
            updatedFields.rateType, updatedFields.rateType, updatedFields.status, updatedFields.status,
            updatedFields.roleId, updatedFields.roleId, updatedFields.roleId, updatedFields.productId,
            updatedFields.productId, updatedFields.appliedUserId, updatedFields.appliedUserId, updatedFields.appliedUserId,
            updatedFields.priority, updatedFields.priority, updatedFields.rateApplicableType, updatedFields.rateApplicableType,
            updatedFields.rateAmount, updatedFields.rateAmount, updatedFields.updatedBy, updatedFields.productRatesId
        ];

        db.mysql.query(queries.updateProductRates, replacements, function (err, results, fields) {
            if (err && err.code === 'ER_DUP_ENTRY') {
                return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, 'This Commission Rate already exists'));
            }

            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            if (results.affectedRows === 0) {
                return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, 'Update operation failed. Please try again.'));
            }

            return callback();
        });
    },
    fetchProductRates: function (filters, data, callback) {
        let columns = [
            'pr.rate_id', 'pr.rate_productid', 'pr.rate_roleid', 'pc.category_id',
            'pr.rate_type', 'pr.rate_userid', 'pr.rate_applicable_type'
        ];
        let values = [
            filters.rateId, filters.productId, filters.roleId, filters.categoryId,
            filters.rateType, filters.appliedUserId, filters.rateApplicableType
        ];
        let condition = utils.generateDynamicWhereCondition(columns, values);

        db.mysql.query(queries.fetchProductRates(condition.whereCondition), condition.replacements, function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            data.push(...results);

            return callback();
        });
    },
    fetchProductInfoForTopUp: function ({ operator, type, country }, data, callback) {
        db.mysql.query(queries.productInfoForTopUp, [operator, type, country], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            if (results.length <= 0) {
                return callback(resGen.responseGenerator(resGen.NOT_FOUND, 'Top up for this operator is currently unavailable. Please try later.'));
            }

            Object.assign(data, results[0]);
            callback();
        });
    },
    fetchProductInfoForTopUpMobile: function ({ operator, type, country }, data, callback) {
            db.mysql.query(queries.productInfoForTopUpMobile, [operator, type, country], function (err, results, fields) {
                if (err) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                }

                if (results.length <= 0) {
                    return callback(resGen.responseGenerator(resGen.NOT_FOUND, 'Top up for this operator is currently unavailable. Please try later.'));
                }

                Object.assign(data, results[0]);
                callback();
            });
        },
    fetchProductInfoForDataPack: function (datapackId, data, callback) {
        db.mysql.query(queries.productInfoForDataPack, [datapackId], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }


            if (results.length <= 0) {
                return callback(resGen.responseGenerator(resGen.NOT_FOUND, 'Datapack for this operator is currently unavailable. Please try later.'));
            }

            Object.assign(data, results[0]);
            callback();
        });
    },
    fetchProductInfoForZulu: function (datapackId, data, callback) {
        db.mysql.query(queries.productInfoForZulu, [datapackId], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            if (results.length <= 0) {
                return callback(resGen.responseGenerator(resGen.NOT_FOUND, 'This package is  currently unavailable. Please try later.'));
            }

            Object.assign(data, results[0]);
            callback();
        });
    },
    fetchDataPackList: function (userInfo, country, data, callback) {
        let condition = utils.generateDynamicWhereCondition([
            'product_status', 'product_category_id', 'currency_country_name'
        ], [1, config.categoryIdMapping.INTERNET, country]);
        db.mysql.query(queries.dataPackList(userInfo.userId, userInfo.roleId, condition.whereCondition), condition.replacements, function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            data.push(...results);
            callback();
        });
    },
    fetchProductsInfoUsingOperator: function (operators, data, callback) {
        let query = operators.length === 1 ?
            queries.singleProductInfoUsingOperator :
            queries.multipleProductsInfoUsingOperator(Array(operators.length).fill('(?)').join(','));

        db.mysql.query(query, operators.length === 1 ? operators[0] : operators, function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            for (let index in results) {
                let result = results[index];
                let key = result.ref1 + '.' + result.ref2;
                data[key] = result;
            }

            callback();
        });
    },
    fetchProductsInfoUsingOperatorCode: function (operatorCode, productInfo, callback) {
        db.mysql.query(queries.productInfoUsingOperatorCode, [operatorCode], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            if (results.length === 0) {
                return callback(resGen.responseGenerator(resGen.NOT_FOUND, 'Incorrect operator code'));
            }

            Object.assign(productInfo, results[0]);
            callback();
        });
    },
    createPackage: function (input, callback) {
        let replacements = [input.packageName, input.packageDescription, input.packageSalesValue, input.createdBy];

        let connection;
        let packageId;
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
                connection.query(queries.createPackage, [
                    input.packageName, input.packageDescription, input.groupName,
                    input.isViewable, input.packageSalesValue, input.createdBy
                ], function (err, results, fields) {
                    if (err && err.code === 'ER_DUP_ENTRY') {
                        return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, 'Package name already exists'));
                    }

                    if (err) {
                        return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                    }

                    packageId = results.insertId;
                    callback();
                });
            },
            callback => {
                if (input.productList.length === 0) return callback();

                async.eachOfSeries(input.productList, function (item, key, callback) {
                    item = Object.assign({ order: 0, executeAfter: 0 }, item);

                    let replacements = [
                        packageId, item.id, item.order, item.executeAfter,
                        input.createdBy, item.order, item.executeAfter, input.createdBy
                    ];

                    connection.query(queries.insertPackageProductsRelation, replacements, function (err, results, fields) {
                        if (err && err.code === 'ER_NO_REFERENCED_ROW_2') {
                            return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, 'Incorrect Product-Id'));
                        }

                        if (err) {
                            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                        }

                        if (results.affectedRows === 0) {
                            return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, 'Unable to add the product'));
                        }

                        return callback();
                    });
                }, err => {
                    if (err) {
                        return callback(err);
                    }

                    return callback();
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
    updatePackage: function (updatedFields, callback) {
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
                if (!updatedFields.packageUpdateNeeded) return callback();

                let replacements = [
                    updatedFields.packageName, updatedFields.packageName, updatedFields.packageDescription,
                    updatedFields.packageDescription, updatedFields.groupName, updatedFields.groupName,
                    updatedFields.isViewable, updatedFields.isViewable, updatedFields.status, updatedFields.status,
                    updatedFields.packageSalesValue, updatedFields.packageSalesValue, updatedFields.updatedBy, updatedFields.packageId
                ];

                connection.query(queries.updatePackage, replacements, function (err, results, fields) {
                    if (err && err.code === 'ER_DUP_ENTRY') {
                        return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, 'This package name is already exists'));
                    }

                    if (err) {
                        return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                    }

                    if (results.affectedRows === 0) {
                        return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, 'Update failed. Please try again'));
                    }

                    callback();
                });
            },
            callback => {
                if (updatedFields.productList.add.length === 0) return callback();

                async.eachOfSeries(updatedFields.productList.add, function (item, key, callback) {
                    let replacements = [
                        updatedFields.packageId, item.id, item.order, item.executeAfter,
                        updatedFields.updatedBy, item.order, item.executeAfter, updatedFields.updatedBy
                    ];

                    connection.query(queries.insertPackageProductsRelation, replacements, function (err, results, fields) {
                        if (err && err.code === 'ER_NO_REFERENCED_ROW_2') {
                            return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, 'Incorrect Product-Id'));
                        }

                        if (err) {
                            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                        }

                        if (results.affectedRows === 0) {
                            return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, 'Unable to add the product'));
                        }

                        return callback();
                    });
                }, err => {
                    if (err) {
                        return callback(err);
                    }

                    return callback();
                });
            },
            callback => {
                if (updatedFields.productList.del.length === 0) return callback();

                async.eachOfSeries(updatedFields.productList.del, function (item, key, callback) {
                    let replacements = [
                        updatedFields.updatedBy, updatedFields.packageId, item
                    ];

                    connection.query(queries.deletePackageProductsRelation, replacements, function (err, results, fields) {
                        if (err) {
                            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                        }

                        if (results.affectedRows === 0) {
                            return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, 'Unable to find the product. Please try again'));
                        }

                        return callback();
                    });
                }, err => {
                    if (err) {
                        return callback(err);
                    }

                    return callback();
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
    retrievePackageInfoWithDetails: function (filters, data, callback) {
        let condition = utils.generateDynamicWhereCondition([
            'p.package_id', 'p.package_groupname', 'p.package_is_viewable', 'p.package_status'
        ], [filters.packageId, filters.groupName, filters.isViewable, filters.status]);

        db.mysql.query(
            queries.packageInfoWithDetails(condition.whereCondition),
            condition.replacements,
            function (err, results, fields) {
                if (err) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                }

                const packages = {};
                results.forEach((packageInfo) => {
                    const { packageId, packageName, salesValue, groupName, isViewable, status, ...productInfo } = packageInfo;
                    if (!packages[packageId]) {
                        packages[packageId] = {
                            packageId: packageId,
                            packageName: packageName,
                            salesValue: salesValue,
                            groupName: groupName,
                            isViewable: isViewable,
                            status: status,
                            productList: []
                        }
                    }
                    if (productInfo.productId) {
                        convertProductInfo(productInfo);
                        packages[packageId]['productList'].push(productInfo);
                    }
                });
                data.push(...Object.values(packages));

                callback();
            });
    },
    storePackagePurchaseOrder: function (packageInfo, request, callback) {
        let connection;

        let packageOrderId;
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
                connection.query(queries.createPackageOrder, [
                    packageInfo.packageId, request.executionRefId, request.userId, request.createdBy
                ], function (err, results, fields) {
                    if (err) {
                        return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                    }

                    packageOrderId = results.insertId;
                    callback();
                });
            },
            callback => {
                if (packageInfo.productList.length === 0) return callback();

                async.eachOfSeries(packageInfo.productList, function (item, key, callback) {
                    connection.query(queries.createPackageOrderDetails, [
                        packageOrderId, item.productId, request.createdBy
                    ], function (err, results, fields) {
                        if (err) {
                            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                        }

                        return callback();
                    });
                }, err => {
                    if (err) {
                        return callback(err);
                    }

                    return callback();
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
    fetchPackageOrder: function (request, data, callback) {
        db.mysql.query(queries.fetchPackageOrder, [request.executionRefId, request.requestedUserId, request.executedProductId],
            function (err, results, fields) {
                if (err) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR));
                }

                if (results.length >= 1) {
                    Object.assign(data, results[0]);
                }

                return callback();
            });
    },
    fetchPackageOrderDetails: function (filters, data, callback) {
        db.mysql.query(
            queries.fetchPackageOrderDetails, [filters.packageOrderDetailsId, filters.requestedUserId],
            function (err, results, fields) {
                if (err) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR));
                }

                if (results.length <= 0) {
                    return callback(resGen.responseGenerator(resGen.NOT_FOUND, 'Incorrect Package-Order Details Id'));
                }

                Object.assign(data, results[0]);
                callback();
            }
        );
    },
    updatePackageOrderDetailsUsingId: function (request, callback) {
        let replacements = [
            request.executedProductId, request.executionId, request.executionStatus, request.updatedBy, request.packageOrderDetailsId
        ];

        db.mysql.query(
            queries.updatePackageOrderDetailsUsingId, replacements,
            function (err, results, fields) {
                if (err) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                }

                return callback();
            });
    },
    fetchChannelList: function (container, callback) {
        const EXPIRATION = 21600;

        db.redis.get(queries.keyForCachedChannelList, function (err, reply) {
            if (!err && reply) {
                container.push(...JSON.parse(reply));
                return callback();
            }

            db.mysql.query(queries.channelList, [], function (err, results, fields) {
                if (err) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR));
                }

                container.push(...results);
                db.redis.set(
                    queries.keyForCachedChannelList,
                    JSON.stringify(container),
                    'EX', EXPIRATION,
                    function (err, reply) {
                        return callback();
                    });
            });
        })
    },
    retrieveProductChargesInformation: function (requestedData, productChargesInfo, callback) {
        // console.log('requestedData', requestedData)
        db.mysql.query(queries.fetchProductChargesInfo, [requestedData.product_id, requestedData.channel, requestedData.status], (err, results, fields) => {
            if (err) {
                Object.assign(productChargesInfo, {charges: 0})
                return callback()
            }
          
            if (results.length === 0) {
                Object.assign(productChargesInfo, {charges: 0})
                return callback()
            }
            
            Object.assign(productChargesInfo, { charges : results[0].charge_amount });
            return callback()
        });

    },
};
