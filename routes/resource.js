'use strict';

const express = require('express');
const async = require('async');

const common = require('../components/common');
const user = require('../components/user');
const banner = require('../components/banner');
const role = require('../components/role');

const resGen = require('../lib/result.codes');

const callback = common.callback;

const router = express.Router();

router.post('/banner-images', function (req, res) {
    const userInfo = [];
    let data = [];

    async.series([
        callback => {
            user.fetchSpecificUserInfo(req.body.userId, userInfo, callback);
        },
        callback => {
            const filters = userInfo.length ? {
                roleId: userInfo[0].roleId,
                nationality: userInfo[0].nationality,
                channel: req.body.os,
            } : {};
            banner.fetchBannerList(filters, data, callback);
        }
    ], err => {
        if (err) {
            return callback(err, req, res);
        }

        callback(null, req, res, data);
    });

});

router.post('/banner/create', function (req, res) {
    const sessionInfo = {};
    let contents = [];
    let container = {};

    let data = [];

    req.body.resources = [req.body.resources];
    async.series([
        callback => {
            common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        },
        callback => {
            if (!req.body.roleId) return callback();

            role.checkIfRoleIdExists(req.body.roleId, {}, callback);
        },
        callback => {
            common.getContentsInformation(req.body.resources, contents, callback);
        },
        callback => {
            common.moveContents(req.body.userId, contents, callback);
        },
        callback => {
            common.setResourcesFields(req.body, contents, callback);
        },
        callback => {
            req.body.createdBy = sessionInfo.username;
            banner.createBanner(req.body, container, callback);
        },
        callback => {
            banner.fetchBannerListWithFilters({ bannerId: container.bannerId }, data, callback);
        }
    ], err => {
        if (err) {
            return callback(err, req, res);
        }

        callback(null, req, res, data);
    });
});

router.post('/banner/update', function (req, res) {
    const sessionInfo = {};
    const prevBanners = [];
    let contents = [];

    let data = [];

    req.body.resources && (req.body.resources = [req.body.resources]);
    async.series([
        callback => {
            common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        },
        callback => {
            banner.fetchBannerListWithFilters({ bannerId: req.body.bannerId }, prevBanners, callback);
        },
        callback => {
            if (prevBanners.length === 0) {
                return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, 'Incorrect Banner-Id'));
            }
            if (!req.body.roleId) return callback();

            role.checkIfRoleIdExists(req.body.roleId, {}, callback);
        },
        callback => {
            if (!req.body.resources) return callback();

            common.getContentsInformation(req.body.resources, contents, callback);
        },
        callback => {
            if (!req.body.resources) return callback();

            common.moveContents(req.body.userId, contents, callback);
        },
        callback => {
            if (!req.body.resources) return callback();

            common.setResourcesFields(req.body, contents, callback);
        },
        callback => {
            req.body.updatedBy = sessionInfo.username;
            banner.updateBanner(req.body, callback);
        },
        callback => {
            banner.fetchBannerListWithFilters({ bannerId: req.body.bannerId }, data, callback);
        }
    ], err => {
        if (err) {
            return callback(err, req, res);
        }

        callback(null, req, res, data);
    });
});

router.post('/banner/list', function (req, res) {
    let data = [];

    async.series([
        callback => {
            common.verifySession(req.body.userId, req.body.sessionId, callback, undefined, req.headers.referer);
        },
        callback => {
            banner.fetchBannerListWithFilters(req.body.filters, data, callback);
        }
    ], err => {
        if (err) {
            return callback(err, req, res);
        }

        callback(null, req, res, data);
    });
});

module.exports = router;
