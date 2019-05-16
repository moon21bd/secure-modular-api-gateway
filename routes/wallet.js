const express      = require('express');
const async        = require('async');
const moment       = require('moment');
const crypto       = require('crypto');

const common       = require('../components/common');
const wallet         = require('../components/wallet');
const product      = require('../components/product');
const order     = require('../components/order');
const role         = require('../components/role');
const rolePermission = require('../lib/role.permission');

const resGen       = require('../lib/result.codes');
const resDet       = require('../lib/result.details');
const utils        = require('../lib/utils');

const cfg          = require('../config');

const router = express.Router();

const callback     = common.callback;

router.post('/wallet/balance-add', function(req, res) {
    let data = {};
    async.series([

       callback => {
            common.verifySession(req.body.userId, req.body.sessionId, callback, undefined, req.headers.referer, false);
        },
        callback => {
            wallet.balanceAdd(req.body, data, callback);
        }
    ], err => {
        if (err) {
            return callback(err, req, res, data);
        }
        callback(null, req, res, data);
    });
});
router.post('/wallet/balance-add/portal', function(req, res) {
    let data = {};
    let request = {
        userId:req.body.walletUserId,
        amount:req.body.amount,
        currencyId:req.body.currencyId,
        walletTypeId:req.body.walletTypeId,
        requestedBy:(!req.body.requestedBy)?'':req.body.requestedBy,
        channel:(!req.body.channel)?'':req.body.channel
    };

    async.series([
          callback => {
              common.verifySession(req.body.userId, req.body.sessionId, callback, undefined, req.headers.referer, false);
          },
        callback => {

            wallet.balanceAdd(request, data, callback);
        }
    ], err => {
        if (err) {
            return callback(err, req, res, data);
        }
        callback(null, req, res, data);
    });
});

module.exports = router;
