'use strict';

const express     = require('express');
const async       = require('async');

const common      = require('../components/common');
const role        = require('../components/role');

const router = express.Router();

const callback = common.callback;

router.post('/role/create', function(req, res) {
    let roleInfo = {};
    let sessionInfo = {};
    let data = [];

    async.series([
        callback => {
            common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        },
        callback => {
            role.checkIfRoleExists(req.body.name, callback);
        },
        callback => {
            role.checkIfAuthorizedToChangeRole(req.body.userId, req.body.level, callback);
        },
        callback => {
            let allowSales = req.body.allowSales === undefined ? 0 : req.body.allowSales;
            let data = [
                req.body.name, req.body.description, req.body.level, req.body.menuPermission, allowSales, sessionInfo['username']
            ];
            role.createRole(data, roleInfo, callback);
        },
        callback => {
            role.retrieveRoles(roleInfo['roleId'], req.body.userId, data, callback);
        }
    ], err => {
        if (err) {
            return callback(err, req, res, data);
        }

        callback(null, req, res, data);
    })
});

router.post('/role/update', function(req, res) {
    let sessionInfo = {};
    let data = [];
    async.series([
        callback => {
            common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        },
        callback => {
            if (!req.body.level) return callback();
            role.checkIfAuthorizedToChangeRole(req.body.userId, req.body.level, callback);
        },
        callback => {
            const name = req.body.name ? req.body.name: '';
            const description = req.body.description ? req.body.description : '';
            const level = req.body.level !== undefined ? req.body.level : -1;
            const menuPermission = req.body.menuPermission ? req.body.menuPermission : '';
            const status = req.body.status !== undefined ? req.body.status : -1;
            const allowSales = req.body.allowSales;
            role.updateRole([
                name, name, description, description, level, level, menuPermission, menuPermission, status, status,
                allowSales, allowSales, sessionInfo['username'], req.body.roleId
            ], callback);
        },
        callback => {
            role.retrieveRoles(req.body.roleId, req.body.userId, data, callback);
        }
    ], err => {
        if (err) {
            return callback(err, req, res, data);
        }

        callback(null, req, res, data);
    })
});

router.post('/role/show', function(req, res) {
    let data = [];
    let sessionInfo = {};
    async.series([
        callback => {
            common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        },
        callback => {
            role.retrieveRoles(req.body.roleId, req.body.userId, data, callback);
        }
    ], err => {
        if (err) {
            return callback(err, req, res);
        }

        callback(null, req, res, data, true);
    })
});

router.post('/role-setting/update', function(req, res) {
    let sessionInfo = {};

    async.series([
        callback => {
            common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        },
        callback => {
            if (!req.body.level) return callback();
            role.checkIfAuthorizedToChangeRole(req.body.userId, req.body.level, callback);
        },
        callback => {
            let updatedFields = req.body.updatedFields;
            let updatedData = [
                updatedFields.allowedUserType, updatedFields.allowedUserType, updatedFields.allowAllStatus, updatedFields.allowAllStatus,
                updatedFields.allowAllRole, updatedFields.allowAllRole, updatedFields.allowAllRoute, updatedFields.allowAllRoute,
                updatedFields.allowProductExecutionUpdate, updatedFields.allowProductExecutionUpdate, sessionInfo['username'], req.body.roleId
            ];
            role.updateRoleSetting(updatedData, callback);
        }
    ], err => {
        if (err) {
            return callback(err, req, res);
        }

        callback(null, req, res);
    })
});

router.post('/role-setting/show', function(req, res) {
    let data = [];
    let sessionInfo = {};
    async.series([
        callback => {
            common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        },
        callback => {
            role.retrieveRoleSetting(req.body.roleId, data, callback);
        }
    ], err => {
        if (err) {
            return callback(err, req, res);
        }

        callback(null, req, res, data);
    })
});

module.exports = router;