'use strict';

const async               = require('async');

const commonDBOperations  = require('../../lib/common.db.operations');
const queries             = require('./queries');
const resGen              = require('../../lib/result.codes');

module.exports = {
    createRoute: function (routeInfo, data, callback) {
        let replacements = [
            routeInfo.name, routeInfo.addressLine1, routeInfo.addressLine2, routeInfo.addressLine3, routeInfo.city,
            routeInfo.zipCode, routeInfo.state, routeInfo.country, routeInfo.otherDetails, routeInfo.createdBy
        ];
        commonDBOperations.createOrUpdate(queries.insertRoute, replacements, callback, data);
    },
    updateRoute: function (routeInfo, callback) {
        let replacements = [
            routeInfo.name, routeInfo.name, routeInfo.status, routeInfo.status, routeInfo.addressLine1, routeInfo.addressLine1,
            routeInfo.addressLine2, routeInfo.addressLine2, routeInfo.addressLine3, routeInfo.addressLine3,
            routeInfo.city, routeInfo.city, routeInfo.zipCode, routeInfo.zipCode,
            routeInfo.state, routeInfo.state, routeInfo.country, routeInfo.country,
            routeInfo.otherDetails, routeInfo.otherDetails, routeInfo.updatedBy, routeInfo.routeId
        ];
        commonDBOperations.createOrUpdate(queries.updateRoute, replacements, callback);
    },
    showRoutes: function (routeId, data, callback) {
        let query = routeId ? queries.fetchSpecificRoute : queries.fetchAllRoutes;
        let replacements = routeId ? [routeId] : [];
        commonDBOperations.fetch(query, replacements, data, callback);
    },
    checkIfRouteExists: function (routeId, callback) {
        let data = [];
        async.series([
            callback => {
                commonDBOperations.fetch(queries.fetchSpecificRoute, [routeId], data, callback);
            },
            callback => {
                if (data.length === 0) {
                    return callback(resGen.responseGenerator(resGen.NOT_FOUND, 'No route info found for route id [' + routeId + ']'));
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
    checkIfDefaultRoute: function (routeId, callback) {
        let data = [];
        async.series([
            callback => {
                commonDBOperations.fetch(queries.isDefaultRoute, [routeId], data, callback);
            },
            callback => {
                if (data.length !== 0) {
                    return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, 'You are not authorized to delete this information'));
                }

                return callback();
            }
        ], err => {
            if (err) {
                return callback(err);
            }

            return callback();
        });
    }
};