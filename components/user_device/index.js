'use strict';

const async = require('async');
const db = require('../../resources/database.connection');
const queries = require('./queries');
const resGen = require('../../lib/result.codes');
const queriesOfSession = require('../common/queries');
const cfg = require('../../config');

function isDeviceRegistered(request, data, container, callback) {
    const deviceId = request.body.deviceId ? request.body.deviceId : request.headers['user-agent'];
    const whereCondition = `AND device_id = '${deviceId}'`;
    db.mysql.query(queries.fetchDevices(whereCondition), [data.userId], function (err, results, fields) {
        if (err) {
            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
        }
        if (results[0]) {
            Object.assign(container, { isAvailable: -1, devices: [] });
            return callback(); // include only => async.series
        }
        return callback();
    });
}

function checkAvailability(data, container, callback) {
    db.mysql.query(queries.fetchDevices(), [data.userId], function (err, results, fields) {
        if (err) {
            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
        }

        if (results.length < cfg.userDevice.maxDeviceRegistrationNo) {
            Object.assign(container, { isAvailable: 1, devices: [] });
        } else {
            let deviceList = [];
            deviceList.push(...results);
            Object.assign(container, {
                isAvailable: 0,
                devices: deviceList,
            });
        }

        callback();
    });
}

function getDeviceList(args, container, callback, query = "") {
    db.mysql.query(queries.fetchDevices(query), [args.userId], function (err, results, fields) {
        if (err) {
            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
        }
        container.push(...results);
        return callback();
    });
}

function validateExistingDevice(args, container, callback) {
    // console.log("Args: ", args);
    db.mysql.query(queries.fetchDevices(), [args.userId], function (err, results, fields) {
        if (err) {
            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
        }
        
        // console.log("Device Total: ", results);
        if (results.length > cfg.userDevice.maxDeviceRegistrationNo){
            Object.assign(container, { isAvailable: 0 });
            return callback();
        }
        
        return callback();
    });
}

function deleteDeviceWithSessions(args, container, callback) {
    let deviceList = [];
    let deviceDeleted = 0;
    let sessionDeleted = 0;
    let query = "";
    async.series([
        callback => {
            query = args.deviceId === 'all' ? `` : `AND device_id = '${args.deviceId}'`;
            getDeviceList(args, deviceList, callback, query);
        },
        callback => {
            deviceList.forEach(device => {
                db.mysql.query(queries.updateDevice, [args.userId, device.device_id], function (err, results, fields) {
                    if (err) {
                        return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                    }
                    deviceDeleted++;
                    deviceDeleted === deviceList.length && callback();
                });
            });
        },
        callback => {
            deviceList.forEach(device => {
                db.redis.del(queriesOfSession.keyForSessionId(args.userId, device.device_session_id), function (err, reply) {
                    if (err) {
                        return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                    }
                    sessionDeleted++;
                    if (sessionDeleted === deviceList.length) {
                        container.push({ "message": "Device removed successfully" });
                        callback();
                    }
                });
            });
        },
    ], err => {
        if (err)
            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
        return callback();
    });
}

function addDevice(args, container, callback) {
    const deviceData = [args.userId, args.deviceId, args.deviceName, args.sessionId];
    db.mysql.query(queries.addDevice, deviceData, function (err, results, fields) {
        if (err) {
            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
        }
        container.push({ "message": "New device registered successfully" });
        return callback();
    });
}

function updateSession(req, data, callback) {
    const deviceId = req.body.deviceId ? req.body.deviceId : req.headers['user-agent'];
    db.mysql.query(queries.updateSession, [data.sessionId, data.userId, deviceId], function (err, results, fields) {
        if (err) {
            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
        }
        return callback();
    });
}

function userDeviceServiceProvider(req, data, deviceContainer, callback) {
    async.series([
        callback => {
            isDeviceRegistered(req, data, deviceContainer, callback);
        },
        callback => {
            if (deviceContainer.isAvailable && deviceContainer.isAvailable === -1) {
                validateExistingDevice(data, deviceContainer, callback);
            } else {
                callback();
            }
        },
        callback => {
            if (!deviceContainer.isAvailable) {
                checkAvailability(data, deviceContainer, callback);
            } else {
                callback();
            }
        },
        callback => {
            if (deviceContainer.isAvailable && deviceContainer.isAvailable === -1) {
                updateSession(req, data, callback);
            } else {
                callback();
            }
        },
    ], err => {
        if (err) {
            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
        }
        return callback();
    });
}

module.exports = {
    userDeviceServiceProvider: userDeviceServiceProvider,
    isDeviceRegistered: isDeviceRegistered,
    checkAvailability: checkAvailability,
    getDeviceList: getDeviceList,
    addDevice: addDevice,
    deleteDeviceWithSessions: deleteDeviceWithSessions,
};
