'use strict';

const express          = require('express');
const async            = require('async');

const callback         = require('../components/common/index').callback;
const verifySession    = require('../components/common/index').verifySession;
const userRoutes       = require('../components/routes/index');
const resGen           = require('../lib/result.codes');
const resDet           = require('../lib/result.details');

const router = express.Router();

router.post('/route/create', function(req, res) {
    let sessionInfo = {};
    let container = {};
    let data = [];

    async.series([
        callback => {
            verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        },
        callback => {
            let routeInfo = {
                name: req.body.name,
                addressLine1: req.body.addressLine1,
                addressLine2: req.body.addressLine2,
                addressLine3: req.body.addressLine3,
                city: req.body.city,
                zipCode: req.body.zipCode,
                state: req.body.state,
                country: req.body.country,
                otherDetails: req.body.otherDetails,
                createdBy: sessionInfo['username']
            };

            userRoutes.createRoute(routeInfo, container, callback);
        },
        callback => {
            userRoutes.showRoutes(container.insertId, data, callback);
        }
    ], err => {
        if (err) {
            return callback(err, req, res);
        }

        callback(null, req, res, data);
    });
});

router.post('/route/update', function(req, res) {
    let sessionInfo = {};

    async.series([
        callback => {
            verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        },
        callback => {
            userRoutes.checkIfRouteExists(req.body.routeId, callback);
        },
        callback => {
            let routeInfo = {
                name: req.body.name,
                status: req.body.status,
                addressLine1: req.body.addressLine1,
                addressLine2: req.body.addressLine2,
                addressLine3: req.body.addressLine3,
                city: req.body.city,
                zipCode: req.body.zipCode,
                state: req.body.state,
                country: req.body.country,
                otherDetails: req.body.otherDetails,
                updatedBy: sessionInfo['username'],
                routeId: req.body.routeId
            };

            userRoutes.updateRoute(routeInfo, callback);
        }
    ], err => {
        if (err) {
            return callback(err, req, res);
        }

        callback(null, req, res);
    });
});

router.post('/route/delete', function(req, res) {
    let sessionInfo = {};

    async.series([
        callback => {
            verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        },
        callback => {
            userRoutes.checkIfDefaultRoute(req.body.routeId, callback);
        },
        callback => {
            let routeInfo = {
                status: 0,
                updatedBy: sessionInfo['username'],
                routeId: req.body.routeId
            };
            userRoutes.updateRoute(routeInfo, callback);
        }
    ], err => {
        if (err) {
            return callback(err, req, res);
        }

        callback(null, req, res);
    });
});

router.post('/route/show', function(req, res) {
    let sessionInfo = {};
    let data = [];

    async.series([
        callback => {
            verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        },
        callback => {
            userRoutes.showRoutes(req.body.routeId, data, callback);
        },
        callback => {
            if (req.body.routeId && data.length === 0) {
                return callback(resGen.responseGenerator(resGen.NOT_FOUND, 'Incorrect route id', resDet.NO_ROUTE_FOUND));
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

module.exports = router;