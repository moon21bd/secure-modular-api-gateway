'use strict';

const mysql     = require('mysql');
const redis     = require('redis');
const async     = require('async');

const cfg       = require('../config');

const dbPool  = mysql.createPool({
                        connectionLimit : cfg.activity_mysql.maxConnections,
                        port            : cfg.activity_mysql.port,
                        host            : cfg.activity_mysql.host,
                        user            : cfg.activity_mysql.username,
                        password        : cfg.activity_mysql.password,
                        database        : cfg.activity_mysql.database,
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