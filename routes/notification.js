'use strict';

const express = require("express");
const async = require('async');

const common = require('../components/common');
const user = require('../components/user');
const callback = common.callback;
const resGen = require('../lib/result.codes');
const resDet = require('../lib/result.details');

const router = express.Router();

router.post('/send/notification', function (req, res) {
  let data = {
    userNameOrId: req.body.userNameOrId,
    title: req.body.title,
    body: req.body.body,
  };

  async.series([
    callback => {
      let userInfo = {
        srcuid: req.body.srcuid,
        srcpwd: req.body.srcpwd,
      }
      user.verifyUser(userInfo, callback);
    },
    callback => {
      common.sendNotification(data, callback);
    },
  ], err => {
    if (err) {
      
      console.log("err", err);
      return callback(err, req, res, null);
    }
    callback(null, req, res, null)
  })
});

module.exports = router;