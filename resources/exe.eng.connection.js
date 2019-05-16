'use strict';

const genericPool = require("generic-pool");
const net = require('net');

const cfg = require('../config');

const factory = {
    create: function() {
        return net.createConnection({ host: cfg.engine.host, port: cfg.engine.port });
    },
    destroy: function(client) {
        client.destroy();
    }
};

const opts = {
    max: cfg.engine.maxConnections,
    min: cfg.engine.minConnections || 1
};

const connectionPool = genericPool.createPool(factory, opts);

module.exports = {
    pool: connectionPool,
    shutdown: function (callback) {
        connectionPool.drain().then(function () {
           connectionPool.clear();
           return callback();
        });
    }
};


