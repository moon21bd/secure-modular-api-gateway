"use strict"

const mysql = require("mysql")
const redis = require("redis")
const async = require("async")

const cfg = require("../config")

const dbPool = mysql.createPool({
    connectionLimit: cfg.activity_mysql.maxConnections,
    port: cfg.inapp_notification.port,
    host: cfg.inapp_notification.host,
    user: cfg.inapp_notification.username,
    password: cfg.inapp_notification.password,
    database: cfg.inapp_notification.database,
    dateStrings: true,
    debug: false && cfg.env === "development" && ["ComQueryPacket"],
})
dbPool.on("connection", function (connection) {
    connection.query("SET SESSION auto_increment_increment=1")
})

dbPool.on("enqueue", function () {
    cfg.logger.error(`Waiting for available connection slot`)
})

module.exports = {
    mysql: dbPool,
    shutdown: function (callback) {
        async.series(
            [
                callback => {
                    dbPool.end(err => callback())
                },
            ],
            err => {
                callback()
            }
        )
    },
}
