'use strict';

const fs = require('fs');
const moment = require('moment');
const async = require('async');
const mkdirs = require('fs-extra').mkdirs;

const db = require('../../resources/database.connection');
const resGen = require('../../lib/result.codes');
const cfg = require('../../config');
const queries = require('./queries');

function checkForCacheDirectory(path, ret, callback) {
  fs.stat(path, function (err, stats) {
    ret.exists = !err || false;
    return callback();
  });
}

function createCacheDirectory(path, callback) {
  mkdirs(path, 0o2644, function (err) {
    if (err) {
      return callback(
        resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err)
      );
    }

    return callback();
  });
}

function isCacheValid(path, ttl, ret, callback) {
  fs.stat(path, function (err, stats) {
    if (err) {
      ret.valid = false;
      return callback();
    }

    ret.valid = (Date.now() - stats.mtimeMs) / 1000 < ttl;
    callback();
  });
}

function reportQueryExecution(
  connection,
  query,
  replacements,
  response,
  callback
) {
  let error = false;
  let process = connection.query(query, replacements);
  let excludes = response.data[0]['excludes'] || [];

  let maxProcessing = 100;
  let timeoutFn;
  process
    .on('error', function (err) {
      error = true;
      return callback(
        resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err)
      );
    })
    .on('fields', function (fields) {
      if (!(fields instanceof Array)) return;

      for (let index in fields) {
        if (!excludes.includes(Number(index))) {
          response.data[0].fields.push(fields[index].name);
        }
      }
    })
    .on('result', function (row) {
      if (row.affectedRows !== undefined) return;

      let rowData = [];
      for (let index in response.data[0].fields) {
        rowData.push(row[response.data[0].fields[index]]);
      }
      response.data[0].values.push(rowData);

      maxProcessing = maxProcessing - 1;
      if (maxProcessing === 0) {
        connection.pause();
        if (timeoutFn) clearTimeout(timeoutFn);

        timeoutFn = setTimeout(() => {
          maxProcessing = 100;
          connection.resume();
        }, 10);
      }
    })
    .on('end', function () {
      if (!error) {
        response.data[0].fields = response.data[0].fields.map((elem) =>
          elem.replace(/_/g, ' ')
        );
        return callback();
      }
    });
}

function reportQueryExecutionWithLimit(
  query,
  replacements,
  response,
  connection,
  callback
) {
  let error = false;
  let process = connection.query(query, replacements);

  let maxProcessing = 100;
  let timeoutFn;
  process
    .on('error', function (err) {
      error = true;
      return callback(
        resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err)
      );
    })
    .on('fields', function (fields) {
      if (!(fields instanceof Array)) return;

      for (let index in fields) {
        response.data[0].fields.push(fields[index].name);
      }
    })
    .on('result', function (row) {
      if (row.affectedRows !== undefined) return;

      let rowData = [];
      for (let index in response.data[0].fields) {
        rowData.push(row[response.data[0].fields[index]]);
      }
      response.data[0].values.push(rowData);

      maxProcessing = maxProcessing - 1;
      if (maxProcessing === 0) {
        connection.pause();
        if (timeoutFn) clearTimeout(timeoutFn);

        timeoutFn = setTimeout(() => {
          maxProcessing = 100;
          connection.resume();
        }, 10);
      }
    })
    .on('end', function () {
      if (!error) {
        response.data[0].fields = response.data[0].fields.map((elem) =>
          elem.replace(/_/g, ' ')
        );
        return callback();
      }
    });
}

module.exports = {
  reportQueryExecutionUsingPagination: function (
    query,
    replacements,
    response,
    callback
  ) {
    let connection;

    async.series(
      [
        (callback) => {
          db.mysql.getConnection((err, conn) => {
            if (err) {
              return callback(
                resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err)
              );
            }

            connection = conn;
            callback();
          });
        },
        (callback) => {
          response['data'] = [
            {
              fields: [],
              values: [],
              totalFiltered: 0,
            },
          ];
          reportQueryExecutionWithLimit(
            query,
            replacements,
            response,
            connection,
            callback
          );
        },
        (callback) => {
          connection.query(
            'SELECT FOUND_ROWS() AS totalFiltered',
            [],
            function (err, results, fields) {
              if (err || results.length <= 0) {
                return callback(
                  resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err)
                );
              }

              response.data[0].totalFiltered = results[0]['totalFiltered'];
              callback();
            }
          );
        },
      ],
      (err) => {
        if (connection) connection.release();

        if (err) return callback(err);

        callback();
      }
    );
  },
  generateReport: function (query, replacements, callback) {
    let response = {
      status: 200,
      code: '0',
      title: 'Success',
      details: 'Success',
      timestamp: Math.floor(Date.now() / 1000),
      data: [
        {
          lastUpdateTime: moment().format('YYYY-MM-DD HH:mm:ss'),
          fields: [],
          values: [],
        },
      ],
    };

    db.mysql.getConnection((err, connection) => {
      if (err) {
        return callback(
          resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err)
        );
      }

      reportQueryExecution(connection, query, replacements, response, (err) => {
        connection.release();

        if (err) {
          return callback(err);
        }

        return callback(null, JSON.stringify(response));
      });
    });
  },

  findTransactionDetails: function (argu, data, callback) {
    // let replacements = [argu.type, argu.userId, argu.sessionId];
    let replacements = [argu.transferId];

    const limit = 'limit' in argu ? argu.limit : 50;
    const offset = 'offset' in argu ? argu.offset : 0;

    let query = queries.findTransactionDetails(argu.userId, limit, offset);

    db.mysql.query(query, [replacements], function (err, results, fields) {
      if (err) {
        return callback(
          resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err)
        );
      }

      console.log('results are ', results);

      if (results.length === 0) {
        return callback(
          resGen.responseGenerator(resGen.NOT_FOUND, 'No information found')
        );
      }

      data.push(results);

      callback();
    });
  },
  sendOrUpdateCacheReport: function (type, query, replacements, callback) {
    let path = './cache/reports/';
    let file = path + replacements[1] + '.' + type + '.json';
    let ret = {};
    let cachedData;
    let connection;

    let response = {
      status: 200,
      code: '0',
      title: 'Success',
      details: 'Success',
      timestamp: Math.floor(Date.now() / 1000),
      data: [
        {
          lastUpdateTime: moment().format('YYYY-MM-DD HH:mm:ss'),
          fields: [],
          values: [],
        },
      ],
    };

    async.series(
      [
        (callback) => {
          checkForCacheDirectory(path, ret, callback);
        },
        (callback) => {
          if (ret.exists) return callback();
          createCacheDirectory(path, callback);
        },
        (callback) => {
          isCacheValid(file, cfg.ttl.reportscache, ret, callback);
        },
        (callback) => {
          if (ret.valid) return callback();
          db.mysql.getConnection((err, conn) => {
            if (err) {
              return callback(
                resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err)
              );
            }

            connection = conn;
            callback();
          });
        },
        (callback) => {
          if (ret.valid) return callback();
          reportQueryExecution(
            connection,
            query,
            replacements,
            response,
            callback
          );
        },
        (callback) => {
          if (ret.valid) return callback();
          fs.writeFile(file, JSON.stringify(response), (err) => {
            if (err) {
              return callback(
                resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err)
              );
            }

            return callback();
          });
        },
        (callback) => {
          fs.readFile(file, function (err, data) {
            if (err) {
              return callback(
                resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err)
              );
            }

            cachedData = data;
            return callback();
          });
        },
      ],
      (err) => {
        if (connection) connection.release();

        if (err) {
          return callback(err);
        }

        return callback(null, cachedData);
      }
    );
  },
};
