"use strict";
const async = require("async");
const resGen = require("../lib/result.codes");
const moment = require("moment");
const activityLogService = require("../components/common/activitylog/activityLogService");

const activityLog = function (req, res, next) {

  let ip = (req.connection && req.connection.remoteAddress) ? req.connection.remoteAddress : req.ip;

  if (req.headers['x-forwarded-for']) {
      ip = req.headers['x-forwarded-for'];
      console.log("x-forwarded-for without split is ", ip);
  }

  const activityLogData = {
    request_id: moment().unix(),
    request_url: req.protocol + '://' + req.get('host') + req.originalUrl,
    //api_request: JSON.stringify(req.body),
    api_request: JSON.stringify({}),
    // ip: req.ip || req.socket.remoteAddress,
    ip: req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    device: req.get('user-agent')
  };

  const callback = function (err) {
    if (err) {
      return res.json(resGen.finalizeResponse(err));
    }
    next();
  };

  let logReceiver = [];
  async.series([
    (callback) => {
      activityLogService.createActivityLog(activityLogData, logReceiver, callback);
    },
  ],
    (err) => {
      if (err) {
        return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, "Activity Log Exception Occured"));
      }

      // console.info("Activity Log: ", logReceiver.logId);
      req.body.logId = logReceiver.logId;
      callback();
    });
};

module.exports = {
  activityLog: activityLog,
};
