'use strict';

const async     = require('async');

const db       = require('../../resources/database.connection');
const resGen    = require('../../lib/result.codes');
const resDet    = require('../../lib/result.details');
const utils     = require('../../lib/utils');

const queries   = require('./queries');

function checkIfRoleIdExists(roleId, roleInfoContainer, callback) {
    db.mysql.query(queries.checkIfRoleIdExists, [roleId],
        function(err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            if (results.length === 0) {
                return callback(resGen.responseGenerator(resGen.NOT_FOUND, 'No role information found with id [' + roleId + ']', resDet.NO_ROLE_FOUND));
            }

            Object.keys(results[0]).forEach((key) => roleInfoContainer[key] = results[0][key]);
            callback();
        });
}

function checkIfAuthorizedToChangeRole(userId, expectedRoleLevel, callback) {
    db.mysql.query(queries.checkRoleLevel, [expectedRoleLevel, userId], function (err, results, fields) {
        if (err) {
            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
        }

        if (results.length === 0) {
            return callback(resGen.responseGenerator(resGen.NOT_FOUND, 'Incorrect User Id', resDet.NO_USER_FOUND))
        }

        if (results[0].isAuthorized === 0) {
            return callback(resGen.responseGenerator(resGen.AUTH_ERR, 'User does not have sufficient permissions', resDet.AUTHORIZATION_FAILED));
        }

        return callback();
    });
}

module.exports = {
    checkIfRoleIdExists: checkIfRoleIdExists,
    validateRoleId: function (userId, roleId, callback) {
        if (!roleId) return callback();

        let roleInfoContainer = {};
        async.series([
            callback => {
                checkIfRoleIdExists(roleId, roleInfoContainer, callback);
            },
            callback => {
                checkIfAuthorizedToChangeRole(userId, roleInfoContainer.level, callback);
            }
        ], err => {
            if (err) {
                return callback(err);
            }

            callback();
        });
    },
    checkIfRoleExists: function (roleName, callback) {
        db.mysql.query(queries.checkIfRoleExists, [roleName], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            if (results.length !== 0) {
                return callback(resGen.responseGenerator(resGen.ACTION_NOT_SUPPORTED_ERR, 'Role with name [' + roleName + '] already exists', resDet.DUPLICATE_ROLE_NAME));
            }

            return callback();
        });
    },
    checkIfAuthorizedToChangeRole: checkIfAuthorizedToChangeRole,
    createRole: function (roleInfo, data, callback) {
        let connection;

        async.series([
            callback => {
                db.mysql.getConnection((err, conn) => {
                    if (err) {
                        return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                    }

                    connection = conn;
                    callback();
                });
            },
            callback => {
                connection.beginTransaction(function (err) {
                    if (err) {
                        return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                    }

                    return callback();
                });
            },
            callback => {
                connection.query(queries.createRole, roleInfo,
                    function (err, results, fields) {
                        if (err) {
                            return connection.rollback(function () {
                                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                            });
                        }

                        if (results.affectedRows === 0) {
                            return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, undefined, resDet.ROLE_CREATE_FAILED));
                        }

                        data.roleId = results.insertId;
                        callback();
                    });
            },
            callback => {
                connection.query(queries.createRoleSetting, [data.roleId, roleInfo[roleInfo.length - 1]],
                    function (err, results, fields) {
                        if (err) {
                            return connection.rollback(function () {
                                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                            });
                        }

                        if (results.affectedRows === 0) {
                            return connection.rollback(function () {
                                return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, undefined, resDet.ROLE_CREATE_FAILED));
                            });
                        }

                        callback();
                    });
            },
            callback => {
                connection.commit((err) => {
                    if (err) {
                        return connection.rollback(function () {
                            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                        });
                    }

                    return callback();
                });
            }
        ], err => {
            if (connection) {
                connection.release();
            }

            if (err) {
                return callback(err);
            }

            return callback();
        });
    },
    retrieveRoles: function (roleId, userId, data, callback) {
        let replacements = roleId ? [roleId, userId] : [userId];
        db.mysql.query(roleId ? queries.fetchSpecificRole : queries.fetchAllRoles, replacements,
            function (err, results, fields) {
                if (err) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                }

                Object.keys(results).forEach((index) => {
                    data.push(results[index]);
                });

                if (roleId && data.length === 0) {
                    return callback(resGen.responseGenerator(resGen.NOT_FOUND));
                }

                callback();
            });
    },
    updateRole: function (updatedData, callback) {
        db.mysql.query(queries.updateRole, updatedData,
            function (err, results, fields) {
                if (err && err.code === 'ER_DUP_ENTRY') {
                    return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, 'Duplicate role name', resDet.DUPLICATE_ROLE_NAME));
                }

                if (err) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                }

                if (results.affectedRows === 0) {
                    return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, undefined, resDet.ROLE_UPDATE_FAILED));
                }

                callback();
            });
    },
    updateRoleSetting: function (updatedData, callback) {
        db.mysql.query(queries.updateRoleSetting, updatedData,
            function (err, results, fields) {
                if (err) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                }

                if (results.affectedRows === 0) {
                    return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, 'Role setting update failed', resDet.ROLE_SETTING_UPDATE_FAILED));
                }

                callback();
            });
    },
    retrieveRoleSetting: function (roleId, data, callback) {
        db.mysql.query(queries.fetchSpecificRoleSetting, [roleId],
            function (err, results, fields) {
                if (err) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                }

                if (results.length === 0) {
                    return callback(resGen.responseGenerator(resGen.NOT_FOUND, 'Incorrect role id', resDet.NO_ROLE_FOUND));
                }

                data.push(results[0]);

                callback();
            });
    },
    retrieveRolePermission: function (filters, container, callback) {
        let condition = utils.generateDynamicWhereCondition(
            ['role_permission_id', 'role_permission_role_id', 'role_permission_status'],
            [filters.rolePermissionId, filters.roleId, 1]
        );

        db.mysql.query(queries.fetchRolePermission(condition.whereCondition), condition.replacements,
            function (err, results, fields) {
                if (err) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                }

                results.forEach(result => {
                    let contexts = JSON.parse(result.context);
                    let processedContexts = {};
                    contexts.forEach((context) => {
                       processedContexts[context.attribute] = context;
                    });

                    container[result.resource] = {
                        actionType: result.actionType,
                        resource: result.resource,
                        attributes: (result.attributes || '*').split(','),
                        context: processedContexts
                    }
                });

                return callback();
            }
        );
    }
};