'use strict';

const mysql     = require('mysql');
const redis     = require('redis');
const async     = require('async');

const cfg       = require('../config');

const dbPool  = mysql.createPool({
    connectionLimit : cfg.sales.maxConnections,
    port            : cfg.sales.port,
    host            : cfg.sales.host,
    user            : cfg.sales.username,
    password        : cfg.sales.password,
    database        : cfg.sales.database,
    dateStrings     : true,
    debug           : false && cfg.env === 'development' && ['ComQueryPacket']
});

/* dbPool.on('acquire', function (connection) {
    cfg.logger.info(`Connection ${connection.threadId} acquired`);
}); */

dbPool.on('connection', function (connection) {
    connection.query('SET SESSION auto_increment_increment=1')
});

dbPool.on('enqueue', function () {
    cfg.logger.error(`Waiting for available connection slot`);
});

/* dbPool.on('release', function (connection) {
    cfg.logger.info(`Connection ${connection.threadId} released`);
}); */

const redisOptions = {
    host: cfg.redis.host,
    port: cfg.redis.port,
    password: cfg.redis.password,
    db: cfg.redis.database
};

let redisClient = redis.createClient(redisOptions);

redisClient.on('error', function(err) {
    cfg.logger.error(err);
});


module.exports = {
    mysql: dbPool,
    redis: redisClient,
    shutdown: function (callback) {
        async.series([
            callback => {
                dbPool.end((err) => callback());
            },
            callback => {
                redisClient.quit((err) => callback());
            }
        ], (err) => {
            callback();
        });
    }
};