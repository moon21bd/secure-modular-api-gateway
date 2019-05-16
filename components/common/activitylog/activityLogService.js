const resGen = require("../../../lib/result.codes");
const db = require("../../../resources/activity.database.connection");
const queries = require("../activitylog/queries");

module.exports = {
  createActivityLog: function (args, container, callback) {
    const logData = [
      args.request_id,
      args.request_url,
      args.api_request,
      args.ip,
      args.device,
    ];

    db.mysql.query(queries.createActivityLog, logData, function (err, result, fields) {
      if (err) {
        return callback(resGen.INTERNAL_SERVER_ERROR, err);
      }

      Object.assign(container, { logId: result.insertId });
      return callback();
    });
  },

  updateActivityLogEntry: function (logId, data, callback) {
    const updationData = [data.user_id, data.api_response, logId];
    db.mysql.query(queries.updateActivityLog, updationData, function (err, result, fields) {
      if (err) {
        console.error("ActivityLog updation error: ", err);
        return callback();
      }
      return callback();
    });
  },
};
