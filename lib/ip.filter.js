'use strict';

const resGen    = require('../lib/result.codes');
const config    = require('../config');

const paths = [
    '/api/bd-order-api',
    '/api/bd-order-api-status',
    '/api/platform-get-balance',
    '/api/country-b-order-api',
    '/api/country-b-order-api-status'
];

module.exports = function (req, res, next) {
    let clientIp = req.connection.remoteAddress;
    if (!clientIp) {
        return res.json(resGen.responseGenerator(resGen.AUTH_ERR));
    }

    if (config.ipFilter.enable
        && paths.some((path) => (path === req.originalUrl))) {
        let blacklist = config.ipFilter.blacklist || [];
        if (blacklist.some((ip) => clientIp.match(ip) !== null)) {
            return res.json({ status: 401, error: 'Your IP is black-listed ! Please contact Platform Support !'});
        }

        let whitelist = config.ipFilter.whitelist || [];
        if (whitelist.length === 0 || whitelist.some((ip) => clientIp.match(ip) !== null)) {
            next();
            return;
        } else {
            return res.json({ status: 401, error: 'Your IP is not listed ! Please contact Platform Support !'});
        }
    }

    next();
};