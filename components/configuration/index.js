'use strict';

const db       = require('../../resources/database.connection');
const resGen   = require('../../lib/result.codes');
const resDet   = require('../../lib/result.details');
const utils    = require('../../lib/utils');

const queries  = require('./queries');

module.exports = {
    createConfiguration: function (request, callback) {
        request.isConfigEditable = request.isConfigEditable !== undefined ? request.isConfigEditable : 1;
        request.isConfigViewable = request.isConfigViewable !== undefined ? request.isConfigViewable : 1;

        let replacements = [
            request.configType, request.configName, request.configDescription, request.configValue,
            request.isConfigEditable, request.isConfigViewable, request.createdBy
        ];

        db.mysql.query(queries.createConfiguration, replacements, function (err, results, fields) {
            if (err && err.code === 'ER_DUP_ENTRY') {
                return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, 'Duplicate configuration name', resDet.DUPLICATE_CONFIGURATION_NAME));
            }

            if (err) {
                return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR));
            }

            return callback();
        });
    },
    updateConfiguration: function (request, callback) {
        let replacements = [
            request.configType, request.configType, request.configName, request.configName,
            request.configDescription, request.configDescription, request.configValue, request.configValue,
            request.isConfigEditable, request.isConfigEditable, request.isConfigViewable, request.isConfigViewable,
            request.updatedBy, request.configId
        ];

        db.mysql.query(queries.updateConfiguration, replacements, function (err, results, fields) {
            if (err && err.code === 'ER_DUP_ENTRY') {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, 'Duplicate configuration name', resDet.DUPLICATE_CONFIGURATION_NAME));
            }

            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            if (results.affectedRows === 0) {
                return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR));
            }

            return callback();
        });
    },
    showConfiguration: function (request, data, callback) {
        let condition = utils.generateDynamicWhereCondition(['config_param_id', 'config_param_type', 'config_isviewable'], [request.configId, request.configType, 'Yes'], ['=', '=', '=']);
        db.mysql.query(queries.showConfiguration(condition.whereCondition), condition.replacements, function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            if (results.length === 0 && request.configId) {
                return callback(resGen.responseGenerator(resGen.NOT_FOUND, 'No configuration found', resDet.NO_CONFIG_FOUND));
            }

            data.push(...results);
            return callback();
        });
    }
};