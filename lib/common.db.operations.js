'use strict';

const db     = require('../resources/database.connection');
const resGen = require('./result.codes');
const util   = require('./utils');

module.exports = {
    createOrUpdate: function (query, replacements, callback, container) {
        db.mysql.query(query, replacements,
            function (err, results, fields) {
                if (err || results.length <= 0) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                }

                if (results.affectedRows === 0) {
                    return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR));
                }

                if (container) {
                    container.insertId = results.insertId;
                }
                callback();
            });
    },
    fetch: function (query, replacements, data, callback, modifier) {
        db.mysql.query(query, replacements,
            function (err, results, fields) {
                if (err) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                }

                if (!modifier) {
                    data.push(...results);
                    return callback();
                }

                util.forEachAsync(results, function (result) {
                    modifier.apply(null, [result]);
                    data.push(result);
                }, callback)
            });
    }
};