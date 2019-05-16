'use strict';

const db      = require('../../resources/database.connection');
const resGen  = require('../../lib/result.codes');
const resDet  = require('../../lib/result.details');
const utils   = require('../../lib/utils');

const queries = require('./queries');

const currencyInfo = {};
db.mysql.query(queries.fetchCurrencyList('WHERE 1=1'), function (err, results, fields) {
    if (err) {
        console.log(err);
        process.exit(1);
    }

    results.forEach((item) => {
        currencyInfo[item.countryName.toLowerCase()] = {
            status: item.status === 1,
            currencyId: item.currencyId,
            currencyConversionRate: item.currencyConversionRate,
            isoAlpha2Code: item.isoAlpha2Code
        };
    });
});

module.exports = {
    createCurrency: function (request, callback) {
        let replacements = [
            request.currencyName, request.currencyDescription, request.currencyConversionRate,
            request.countryName, request.countryCode, request.isoAlpha2Code, request.createdBy
        ];
        db.mysql.query(queries.createCurrency, replacements, function (err, results, fields) {
            if (err && err.code === 'ER_DUP_ENTRY') {
                return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, 'Duplicate currency name', resDet.DUPLICATE_CURRENCY_NAME));
            }

            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            currencyInfo[request.countryName.toLowerCase()] = {
                status: true,
                currencyId: results.insertId,
                currencyConversionRate: request.currencyConversionRate,
                isoAlpha2Code: request.isoAlpha2Code
            };

            return callback();
        });
    },
    updateCurrency: function (request, callback) {
        let replacements = [
            request.currencyName, request.currencyName, request.currencyDescription, request.currencyDescription,
            request.status, request.status, request.currencyConversionRate, request.currencyConversionRate,
            request.countryName, request.countryName, request.countryCode, request.countryCode,
            request.isoAlpha2Code, request.isoAlpha2Code, request.updatedBy, request.currencyId
        ];

        db.mysql.query(queries.updateCurrency, replacements, function (err, results, fields) {
            if (err && err.code === 'ER_DUP_ENTRY') {
                return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, 'Duplicate currency name', resDet.DUPLICATE_CURRENCY_NAME));
            }

            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            if (results.affectedRows === 0) {
                return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR));
            }

            if (request.status !== undefined ||
              request.currencyConversionRate !== undefined ||
              request.isoAlpha2Code !== undefined) {
                let values = Object.values(currencyInfo);
                for (let index in values) {
                    let value = values[index];
                    if (value.currencyId === request.currencyId) {
                        value.status = request.status !== undefined ? request.status === 1 : value.status;
                        value.currencyConversionRate = request.currencyConversionRate || value.currencyConversionRate;
                        value.isoAlpha2Code = request.isoAlpha2Code || value.isoAlpha2Code;
                        break;
                    }
                }
            }

            return callback();
        });
    },
    retrieveCurrencyList: function (filters, data, callback) {
        let condition = utils.generateDynamicWhereCondition(['currency_country_id'], [filters.currencyId], ['=']);
        db.mysql.query(queries.fetchCurrencyList(condition.whereCondition), condition.replacements,
            function (err, results, fields) {
                if (err) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                }

                Object.keys(results).forEach((index) => {
                    data[index] = {};
                    Object.assign(data[index], results[index]);
                    data[index].isBaseCurrency = data[index].isBaseCurrency === 1;
                });

                callback();
            });
    },
    verifyCurrencyId: function (currencyId, callback) {
        db.mysql.query(queries.verifyCurrencyId, [currencyId],
            function (err, results, fields) {
                if (err) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                }

                if (results.length === 0) {
                    return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, 'Invalid currency id', resDet.INVALID_CURRENCY_ID));
                }

                callback();
            });
    },
    getCurrencyIdForCountry: function (country) {
        if (!country) return 0;

        let currency = currencyInfo[country.toLowerCase()];
        if (!currency) return 0;

        if (!currency.status) return 0;
        return currency.currencyId;
    },
    getCurrencyInfo: function (country) {
        if (!country) return null;

        let currency = currencyInfo[country.toLowerCase()];
        if (!currency) return null;

        if (!currency.status) return null;
        return currency;
    },
    retrieveCurrencyConversionRateByCurrencyId: function (givenCurrencyId, conversionRate, callback) {
        /*This method takes currency id as inpur and return conversion rate to base currency*/
        db.mysql.query(queries.currencyConversionRateById, [givenCurrencyId],
            function (err, results, fields) {
                if (err) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                }

                if (results.length === 0) {
                    return callback(resGen.responseGenerator(resGen.AUTH_ERR, 'Currency convertion rate is not available', resDet.NO_USER_FOUND));
                }


                Object.keys(results[0]).forEach(key => conversionRate[key] = results[0][key]);
                callback();
            });
    },
    getCurrencyInfoUsingId: function (currencyId) {
        currencyId = Number(currencyId);

        for (let each of Object.values(currencyInfo)) {
            if (each.status && each.currencyId === currencyId) {
                return each;
            }
        }

        return null;
    }
};
