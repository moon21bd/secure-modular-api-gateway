"use strict"

const async = require("async")
const crypto = require("crypto")
const moment = require("moment")
const request = require("request")

const queries = require("./queries")
const db = require("../../resources/database.connection")
const resGen = require("../../lib/result.codes")
const resDet = require("../../lib/result.details")
const common = require("../../components/common")
const product = require("../../components/product")
const fundTransfer = require("../../components/fund_transfer")
const role = require("../../components/role")
const routes = require("../../components/routes")
const cfg = require("../../config")
const order = require("../../components/order")
const userMigration = require("../../components/user_migration")
const fundTransferqueries = require("../../components/fund_transfer/queries")

function updateAuthenticationPair(authenticationPair) {
    if (authenticationPair.password === undefined && authenticationPair.email === undefined) {
        return authenticationPair
    }

    if (authenticationPair.email === undefined) {
        authenticationPair.password = authenticationPair.password === true ? 1 : 0
        authenticationPair.email = authenticationPair.password === 1 ? 0 : authenticationPair.email
    } else if (authenticationPair.password === undefined) {
        authenticationPair.email = authenticationPair.email === true ? 1 : 0
        authenticationPair.password = authenticationPair.email === 1 ? 0 : authenticationPair.password
    } else {
        authenticationPair.password = authenticationPair.password ? 1 : 0
        authenticationPair.email = authenticationPair.email ? 1 : 0
    }

    return authenticationPair
}

function checkIfUserProfileUpdateNeeded(updatedFields) {
    let keys = [
        "fullName",
        "parentId",
        "contactId",
        "status",
        "roleId",
        "password",
        "email",
        "loginEmailAuthentication",
        "fundTransferPasswordAuthentication",
        "fundTransferEmailAuthentication",
        "forgetPasswordEmailAuthentication",
        "deviceRegistrationEmailAuthentication",
        "routeId",
        "profilePic",
        "passportPic",
        "latitude",
        "longitude"
    ]
    return keys.some((element, index, array) => element in updatedFields)
}

function updateUser(userId, updatedFields, updatedBy, callback) {
    let connection
    let contents = []

    async.series(
        [
            callback => {
                common.getContentsInformation(updatedFields.resources, contents, callback)
            },
            callback => {
                common.moveContents(userId, contents, callback)
            },
            callback => {
                common.setResourcesFields(updatedFields, contents, callback)
            },
            callback => {
                db.mysql.getConnection((err, conn) => {
                    if (err) {
                        return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                    }

                    connection = conn
                    callback()
                })
            },
            callback => {
                connection.beginTransaction(function (err) {
                    if (err) {
                        return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                    }

                    return callback()
                })
            },
            callback => {
                if (!updatedFields.password) {
                    return callback()
                }

                updatedFields.password = crypto.createHash("md5").update(updatedFields.password).digest("hex")
                callback()
            },
            callback => {
                if (!checkIfUserProfileUpdateNeeded(updatedFields)) return callback()

                let loginEmailAuthentication =
                    updatedFields.loginEmailAuthentication === undefined
                        ? updatedFields.loginEmailAuthentication
                        : updatedFields.loginEmailAuthentication
                            ? 1
                            : 0
                
                 let forgetPasswordEmailAuthentication = 
                    updatedFields.forgetPasswordEmailAuthentication === undefined
                        ? updatedFields.forgetPasswordEmailAuthentication
                        : updatedFields.forgetPasswordEmailAuthentication 
                            ? 1 
                            : 0

                 let deviceRegistrationEmailAuthentication = 
                    updatedFields.deviceRegistrationEmailAuthentication === undefined
                        ? updatedFields.deviceRegistrationEmailAuthentication
                            : updatedFields.deviceRegistrationEmailAuthentication 
                            ? 1 
                            : 0

                let fullName = updatedFields.fullName
                let password = updatedFields.password
                let status = updatedFields.status
                let parentId = updatedFields.parentId
                let contactId = updatedFields.contactId
                let email = updatedFields.email
                let roleId = updatedFields.roleId
                let authPair = updateAuthenticationPair({
                    password: updatedFields.fundTransferPasswordAuthentication,
                    email: updatedFields.fundTransferEmailAuthentication
                })
                let routeId = updatedFields.routeId
                let profile = updatedFields.profilePic
                let passport = updatedFields.passportPic
                let latitude = updatedFields.latitude
                let longitude = updatedFields.longitude

                let replacements = [
                    fullName,
                    fullName,
                    parentId,
                    parentId,
                    contactId,
                    contactId,
                    password,
                    password,
                    password,
                    password,
                    status,
                    status,
                    email,
                    email,
                    roleId,
                    roleId,
                    loginEmailAuthentication,
                    loginEmailAuthentication,
                    authPair.email,
                    authPair.email,
                    authPair.password,
                    authPair.password,
                    forgetPasswordEmailAuthentication,
                    forgetPasswordEmailAuthentication,
                    deviceRegistrationEmailAuthentication,
                    deviceRegistrationEmailAuthentication,
                    routeId,
                    routeId,
                    profile,
                    profile,
                    passport,
                    passport,
                    latitude,
                    latitude,
                    longitude,
                    longitude,
                    updatedBy,
                    userId
                ]
                connection.query(queries.updateUserProfile, replacements, (err, results, fields) => {
                    if (err) {
                        return connection.rollback(function () {
                            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                        })
                    }

                    callback()
                })
            },
            callback => {
                async.eachOfSeries(
                    updatedFields.productAuthentication,
                    function (item, key, callback) {
                        let authPair = updateAuthenticationPair({
                            password: item.passwordAuthentication,
                            email: item.emailAuthentication
                        })
                        let replacements = [authPair.password, authPair.password, authPair.email, authPair.email, updatedBy, userId, item.categoryId]
                        connection.query(queries.updateUserSettings, replacements, (err, results, fields) => {
                            if (err) {
                                return connection.rollback(function () {
                                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                                })
                            }

                            return callback()
                        })
                    },
                    err => {
                        if (err) {
                            return callback(err)
                        }

                        return callback()
                    }
                )
            },
            callback => {
                connection.commit(err => {
                    if (err) {
                        return connection.rollback(function () {
                            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                        })
                    }

                    return callback()
                })
            }
        ],
        err => {
            if (connection) {
                connection.release()
            }

            if (err) {
                return callback(err)
            }

            return callback()
        }
    )
}

function modifyUserInformation(userList, callback) {
    for (let index in userList) {
        let user = userList[index]
        user.loginEmailAuthentication = user.loginEmailAuthentication === 1
        user.fundTransferEmailAuthentication = user.fundTransferEmailAuthentication === 1
        user.fundTransferPasswordAuthentication = user.fundTransferPasswordAuthentication === 1
        user.forgetPasswordEmailAuthentication = user.forgetPasswordEmailAuthentication === 1
        user.deviceRegistrationEmailAuthentication = user.deviceRegistrationEmailAuthentication === 1


        user.productAuthentication = []
        if (user.categoryIdList && user.categoryList) {
            let categoryIdList = user.categoryIdList.split(",")
            let categoryList = user.categoryList.split(",")
            let viewableList = user.viewableList ? user.viewableList.split(",") : []
            let passwordAuthenticationList = user.passwordAuthenticationList ? user.passwordAuthenticationList.split(",") : []
            let emailAuthenticationList = user.emailAuthenticationList ? user.emailAuthenticationList.split(",") : []

            categoryList.forEach((key, index) => {
                let productAuthenticationInfo = {
                    categoryId: Number(categoryIdList[index]),
                    categoryName: key,
                    isViewable: index in viewableList ? viewableList[index] === "1" : false,
                    passwordAuthentication: index in passwordAuthenticationList ? passwordAuthenticationList[index] === "1" : false,
                    emailAuthentication: index in emailAuthenticationList ? emailAuthenticationList[index] === "1" : false
                }
                user.productAuthentication.push(productAuthenticationInfo)
            })
        }

        if (user.roleSettings) {
            let settingsParts = user.roleSettings.split(",")
            user.roleSettings = {
                allowedUserType: Number(settingsParts[0]),
                allowAllStatus: Number(settingsParts[1]),
                allowAllRole: Number(settingsParts[2]),
                allowAllRoute: Number(settingsParts[3]),
                allowProductExecutionUpdate: Number(settingsParts[4])
            }
        }

        delete user.categoryIdList
        delete user.categoryList
        delete user.viewableList
        delete user.passwordAuthenticationList
        delete user.emailAuthenticationList
    }

    callback()
}

function failedLogInAttemptCheck(userId, username, currentAttempt, currentStatus, callback) {
    if (currentAttempt + 1 > cfg.max_failed_log_in_attempt) {
        return callback(
            resGen.responseGenerator(resGen.TOO_MANY_INVALID_REQUEST, "Exceeded maximum number of failed Login attempts", resDet.TOO_MANY_INVALID_LOGIN_ATTEMPT)
        )
    }

    db.mysql.query(
        queries.incrementLogInAttempt,
        [cfg.max_failed_log_in_attempt - 1, cfg.max_failed_log_in_attempt, username, userId],
        function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            if (results.affectedRows === 0) {
                return callback(
                    resGen.responseGenerator(resGen.AUTH_ERR, "Exceeded maximum number of failed Login attempts", resDet.TOO_MANY_INVALID_LOGIN_ATTEMPT)
                )
            }

            callback(resGen.responseGenerator(resGen.AUTH_ERR, "Username/password does not match", resDet.PASSWORD_NOT_MATCH))
        }
    )
}

module.exports = {
    getUserByUsernameOrId: function (usernameOrId, data, callback) {
        db.mysql.query(queries.getUserByUsernameOrId, [usernameOrId, usernameOrId, usernameOrId], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            if (results.length === 0) {
                return callback(resGen.responseGenerator(resGen.NOT_FOUND, undefined, resDet.NO_USER_FOUND))
            }
            Object.assign(data, results[0])
            callback()
        })
    },
    fetchSpecificUserInfo: function (userId, data, callback) {
        db.mysql.query(queries.specificUserInfo, [userId], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            if (results.length === 0) {
                return callback(resGen.responseGenerator(resGen.NOT_FOUND, undefined, resDet.NO_USER_FOUND))
            }

            data.push(results[0])
            callback()
        })
    },
    supportContacts: function (appType, data, callback) {
        db.mysql.query(queries.supportContacts, [appType], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            if (results.length === 0) {
                return callback(resGen.responseGenerator(resGen.NOT_FOUND, "Support Not Found", resDet.NO_SUPPORT_CONTACTS_FOUND))
            }
            Object.assign(data, results)
            callback()
        })
    },
    retrieveUserInformation: function (username, userInfo, callback) {
        db.mysql.query(queries.login, [username], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            if (results.length === 0 || !results[0].userId) {
                return callback(resGen.responseGenerator(resGen.AUTH_ERR, "Username/password does not match", resDet.INVALID_USER_NAME))
            }

            if (results[0].roleStatus !== 1) {
                return callback(resGen.responseGenerator(resGen.AUTH_ERR, "User does not have any active role", resDet.NO_ACTIVE_ROLE_FOR_USER))
            }

            delete results[0].roleStatus
            Object.keys(results[0]).forEach(key => (userInfo[key] = results[0][key]))
            modifyUserInformation([userInfo], callback)
        })
    },

    retrieveUserInformationForB2b: function (username, userInfo, callback) {
        db.mysql.query(queries.login, [username], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            if (results.length === 0 || !results[0].userId) {
                return callback()
            }

            if (results[0].roleStatus !== 1) {
                return callback()
            }

            Object.keys(results[0]).forEach(key => (userInfo[key] = results[0][key]))
            modifyUserInformation([userInfo], callback)
        })
    },
    retrieveUserInformationForCallback: function (userID, userInfo, callback) {
        db.mysql.query(queries.userDetailsForCallBackQuery, [userID], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            if (results.length === 0) {
                return callback(resGen.responseGenerator(resGen.AUTH_ERR, "No user exists with this userId", resDet.INVALID_USER_NAME))
            }
            Object.keys(results[0]).forEach(key => (userInfo[key] = results[0][key]))
            modifyUserInformation([userInfo], callback)
        })
    },

    retrieveUserBalanceInformationByStatus: function (queryData, userbalance, callback) {
        db.mysql.query(queries.balanceInquiryByStatus, [queryData.username, queryData.status], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }
            if (results.length !== 1) {
                return callback(resGen.responseGenerator(resGen.AUTH_ERR, "User info is not correct", resDet.INVALID_USER_NAME))
            }
            if (results.length === 1) {
                Object.keys(results[0]).forEach(key => (userbalance[key] = results[0][key]))

                /* Object.assign(userbalance,results[0]);*/
            }
            return callback()
        })
    },

    retrieveUserBalanceInformation: function (username, userbalance, callback) {
        db.mysql.query(queries.balanceInquiry, [username], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }
            if (results.length !== 1) {
                return callback(resGen.responseGenerator(resGen.AUTH_ERR, "User info is not correct", resDet.INVALID_USER_NAME))
            }
            if (results.length === 1) {
                Object.keys(results[0]).forEach(key => (userbalance[key] = results[0][key]))

                /* Object.assign(userbalance,results[0]);*/
            }
            return callback()
        })
    },

    retrieveUserBalanceInformationByUserId: function (userId, userbalance, callback) {
        db.mysql.query(queries.balanceInquiryByUserId, [userId, userId], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }
            if (results.length !== 1) {
                return callback(resGen.responseGenerator(resGen.AUTH_ERR, "User info is not correct", resDet.INVALID_USER_NAME))
            }
            if (results.length === 1) {
                Object.keys(results[0]).forEach(key => (userbalance[key] = results[0][key]))
            }
            return callback()
        })
    },

    retrieveUserWalletInformationThirdParty: function (username, walletDetails, callback) {
        db.mysql.query(queries.retrieveWalletInformationByUserName, [username], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            if (results.length > 0) {
                Object.assign(walletDetails, results)
            }
            return callback()
        })
    },

    retrieveUserInformationForB2bServices: function (username, userInfo, callback) {
        db.mysql.query(queries.userInfoForB2bServices, [username], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }
            if (results.length !== 1) {
                return callback(resGen.responseGenerator(resGen.AUTH_ERR, "User info is not correct", resDet.INVALID_USER_NAME))
            }
            if (results.length === 1) {
                Object.keys(results[0]).forEach(key => (userInfo[key] = results[0][key]))
            }
            return callback()
        })
    },

    retrieveUserInformationUsingId: function (userId, userInfo, callback) {
        db.mysql.query(queries.userInfoUsingId, [userId], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            if (results.length === 0) {
                return callback(resGen.responseGenerator(resGen.AUTH_ERR, "UserId does not match", resDet.NO_USER_FOUND))
            }

            if (results[0].roleStatus !== 1) {
                return callback(resGen.responseGenerator(resGen.AUTH_ERR, "User does not have any active role", resDet.NO_ACTIVE_ROLE_FOR_USER))
            }

            delete results[0].roleStatus
            Object.keys(results[0]).forEach(key => (userInfo[key] = results[0][key]))
            callback()
        })
    },
    retrieveLoginData: function (userId, data, callback) {
        db.mysql.query(queries.loginWithOtp, [userId], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            if (results.length === 0) {
                return callback(resGen.responseGenerator(resGen.NOT_FOUND))
            }

            Object.keys(results[0]).forEach(key => (data[key] = results[0][key]))
            modifyUserInformation([data], callback)
        })
    },
    checkAuthorization: function (userInfo, givenPassword, callback, options) {
        let calculatedHashedPassword = crypto.createHash("md5").update(givenPassword).digest("hex")
        if (calculatedHashedPassword !== userInfo.password) {
            return failedLogInAttemptCheck(userInfo.userId, userInfo.username, userInfo.failedLoginAttempt, userInfo.status, callback)
        }

        if (moment(userInfo.passwordExpiry).toDate().getTime() < new Date().getTime()) {
            return callback(resGen.responseGenerator(resGen.ACCESS_PERIOD_OVER, "Password expired", resDet.PASSWORD_EXPIRED))
        }

        if (userInfo.status !== "Active") {
            return callback(resGen.responseGenerator(resGen.AUTH_ERR, "User is currently in " + userInfo.status + " state", resDet.NO_ACTIVE_USER))
        }

        callback()
    },
    failedLogInAttemptCheck: failedLogInAttemptCheck,
    updateLastLoginTime: function (userId, username, callback) {
        db.mysql.query(queries.updateLastLoginTime, [username, userId], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            callback()
        })
    },
    checkIfParentIdExists: function (userId, callback) {
        db.mysql.query(queries.parentIdCheck, [userId], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            if (results.length === 0) {
                return callback(resGen.responseGenerator(resGen.NOT_FOUND, "No parent id found. Please contact support"))
            }

            return callback()
        })
    },
    getTTLForSessionId: function (userId, sessionId, data, callback) {
        let key = queries.keyForSessionId(userId, sessionId)
        common.getTTLForKey(key, data, callback)
    },
    executeSignUpProcedure: function (input, passwordHash, data, callback) {
        db.mysql.query(
            queries.signUp,
            [input.username, input.fullName, passwordHash, input.email, input.countryCode, input.mobileNo, input.username],
            function (err, results, fields) {
                if (err || results.length < 1 || results[0].length < 1) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                }

                let info = results[0][0]
                if (info.error_occurred === 1) {
                    return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, info.error_description, info.error_code))
                }

                data.userId = info.user_id
                data.status = info.user_status
                callback()
            }
        )
    },

    executeSignUpProcedureApp: function (input, passwordHash, data, callback) {
        /*Here in this method first we search for default roleId and currency against country code*/

        let roleId = ""
        let currencyCode = ""
        let email = input.email ? input.email : ""

        if (cfg.countryWiseConfiguration[input.countryCode] && cfg.countryWiseConfiguration[input.countryCode]["roleIdForSignUp"]) {
            roleId = cfg.countryWiseConfiguration[input.countryCode]["roleIdForSignUp"]
        } else {
            roleId = cfg.countryWiseConfiguration["-1"]["roleIdForSignUp"]
        }
        if (cfg.countryWiseConfiguration[input.countryCode] && cfg.countryWiseConfiguration[input.countryCode]["currencyCode"]) {
            currencyCode = cfg.countryWiseConfiguration[input.countryCode]["currencyCode"]
        } else {
            currencyCode = cfg.countryWiseConfiguration["-1"]["currencyCode"]
        }

        let nationality = "NA"
        if (input.nationality) nationality = input.nationality

        const allowDuplicateUser = 1
        db.mysql.query(
            queries.signUpApp,
            [
                input.username,
                input.fullName,
                passwordHash,
                email,
                input.countryCode,
                input.mobileNo,
                input.username,
                roleId,
                "",
                currencyCode,
                nationality,
                "",
                allowDuplicateUser
            ],
            function (err, results, fields) {
                if (err || results.length < 1 || results[0].length < 1) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                }

                let info = results[0][0]
                if (info.error_occurred === 1) {
                    return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, info.error_description, info.error_code))
                }

                data.userId = info.user_id
                data.status = info.user_status
                callback()
            }
        )
    },
    validateExistingUserStatus: function (input, callback) {
        db.mysql.query(queries.checkExistingUser, [input.username], (err, results, fields) => {
            if (err) return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))

            if (results.length === 0) return callback()

            if (results.length && results[0].user_status !== "Active")
                return callback(resGen.responseGenerator(resGen.AUTH_ERR, `Your account is in ${results[0].user_status} status`, resDet.NO_ACTIVE_USER))

            return callback()
        })
    },
    modifyUserInformation: modifyUserInformation,
    checkIfUserExists: function (userId, callback) {
        db.mysql.query(queries.checkUser, [userId], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            if (results.length === 0) {
                return callback(resGen.responseGenerator(resGen.NOT_FOUND, "User with id [" + userId + "] does not exist", resDet.NO_USER_FOUND))
            }

            callback()
        })
    },
    retrievePassword: function (userId, userInfo, callback) {
        db.mysql.query(queries.retrievePassword, [userId], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            if (results.length === 0) {
                return callback(resGen.responseGenerator(resGen.AUTH_ERR, "User does not exist", resDet.NO_USER_FOUND))
            }

            Object.keys(results[0]).forEach(key => (userInfo[key] = results[0][key]))
            callback()
        })
    },
    updatePassword: function (userId, username, password, callback) {
        db.mysql.query(queries.updatePassword, [password, username, userId], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            if (results.affectedRows === 0) {
                return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, "Password did not update", resDet.PASSWORD_UPDATE_FAILED))
            }

            callback()
        })
    },
    setCashAgentId: function ({ assignedUserId, cashAgentId, assignedBy }, callback) {
        db.mysql.query(queries.cashAgentId, [cashAgentId, assignedBy, assignedUserId], function (err, results, fields) {
            if (err && err.code === "ER_DUP_ENTRY") {
                return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, "Duplicate Platform-Cash Agent-Id"))
            }

            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            if (results.affectedRows === 0) {
                return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, "User already assigned as Platform-Cash Agent"))
            }

            callback()
        })
    },
    getUserList: function (userId, data, callback) {
        db.mysql.query(queries.userList, [userId], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            data.push(...results)
            callback()
        })
    },
    getResellerList: function (userId, data, callback, filter) {
        db.mysql.query(queries.resellerList(filter), [userId], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            data.push(...results)
            callback()
        })
    },
    getCashAgentId: function (userId, data, callback) {
        db.mysql.query(queries.fetchCashAgentId, [userId], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            if (results.length === 0) {
                return callback(resGen.responseGenerator(resGen.NOT_FOUND, "Incorrect Cash-Agent-Id"))
            }

            data.cashAgentId = results[0].cashAgentId
            callback()
        })
    },
    getCashAgentInfo: function (container, callback) {
        let url = cfg.platformCash.domain + "/api/users/" + container.cashAgentId

        request(
            {
                url: url,
                method: "GET",
                headers: {
                    "Authorization": container["Authorization"]
                }
            },
            (err, response, body) => {
                if (err) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                }

                try {
                    let apiResponse = JSON.parse(body)
                    if (apiResponse["code"] === 400) {
                        return callback(resGen.responseGenerator(resGen.NOT_FOUND, "No card found"))
                    }

                    container["agentName"] = apiResponse["name"]
                    container["agentPhoneNumber"] = apiResponse["phoneNumber"]
                    container["agentEmail"] = apiResponse["email"]

                    return callback()
                } catch (e) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                }
            }
        )
    },
    getCustomerInfo: function (container, callback) {
        let url = cfg.platformCash.domain + "/api/users?phoneNumber=" + container.mobileNo

        request(
            {
                url: url,
                method: "GET",
                headers: {
                    "Authorization": container["Authorization"]
                }
            },
            (err, response, body) => {
                if (err) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                }

                try {
                    let apiResponse = JSON.parse(body)
                    if (apiResponse["data"].length === 0) {
                        return callback(resGen.responseGenerator(resGen.NOT_FOUND, "No card found"))
                    }

                    let customerInfo = apiResponse["data"][0]
                    if (!customerInfo["card"] || Object.keys(customerInfo["card"]).length === 0) {
                        return callback(resGen.responseGenerator(resGen.NOT_FOUND, "No card found"))
                    }

                    container["customerName"] = customerInfo["name"]
                    container["customerPhoneNumber"] = customerInfo["phoneNumber"]
                    container["customerEmail"] = customerInfo["email"]
                    container["customerCardNumber"] = customerInfo["card"]["cardNo"]

                    return callback()
                } catch (e) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                }
            }
        )
    },
    getCashAgentList: function (data, callback) {
        db.mysql.query(queries.cashAgentList, [], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            data.push(...results)
            callback()
        })
    },
    validateAuthenticationInformation: function (updatedFields, callback) {
        if (updatedFields.fundTransferPasswordAuthentication && updatedFields.fundTransferEmailAuthentication) {
            return callback(
                resGen.responseGenerator(
                    resGen.INVALID_PARAMS_ERR,
                    "Both type of authentication can not be enabled at the same time for point-transfer",
                    resDet.AUTH_FUND_TRANSFER
                )
            )
        }

        if (!updatedFields.productAuthentication || updatedFields.productAuthentication.length === 0) {
            return callback()
        }

        updatedFields.productAuthentication.forEach((authInfo, index) => {
            if (authInfo.passwordAuthentication && authInfo.emailAuthentication) {
                return callback(
                    resGen.responseGenerator(
                        resGen.INVALID_PARAMS_ERR,
                        "Both type of authentication can not be enabled at the same time for category id [" + authInfo.categoryId + "]",
                        resDet.AUTH_PRODUCT_CATEGORY
                    )
                )
            }

            if (index === updatedFields.productAuthentication.length - 1) {
                return callback()
            }
        })
    },
    updateUser: updateUser,
    createUserProfile: function (input, passwordHash, data, callback) {
        db.mysql.query(
            queries.createUserProfile,
            [input.username, input.fullName, passwordHash, input.parentId, input.contactId, input.email, input.countryCode, input.mobileNo, input.createdBy],
            function (err, results, fields) {
                if (err || results.length <= 0 || results[0].length <= 0) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                }
                let info = results[0][0]
                if (info.error_occurred === 1) {
                    return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, info.error_description, info.error_code))
                }

                data.userId = info.user_id
                data.status = info.user_status
                callback()
            }
        )
    },
    createUserProfileGenreic: function (input, passwordHash, data, callback) {
        /*contact ID is being used as parent id for voice in input parameter list*/

        const allowDuplicateUser = input.allowDup ? 1 : 0
        db.mysql.query(
            queries.createUserProfileGeneric,
            [
                input.username,
                input.fullName,
                passwordHash,
                input.parentId,
                input.parentId,
                input.email,
                input.countryCode,
                input.mobileNo,
                input.createdBy,
                input.roleId,
                input.channel,
                input.ref_1,
                input.ref_2,
                input.ref_3,
                allowDuplicateUser
            ],
            function (err, results, fields) {
                if (err || results.length <= 0 || results[0].length <= 0) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                }
                let info = results[0][0]
                if (info.error_occurred === 1) {
                    return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, info.error_description, info.error_code))
                }
                data.userId = info.user_id
                data.status = info.user_status
                callback()
            }
        )
    },
    createResellerProfile: function (input, passwordHash, data, callback) {
        db.mysql.query(
            queries.createResellerProfile,
            [input.username, input.fullName, passwordHash, input.email, input.countryCode, input.mobileNo, input.userId, input.createdBy],
            function (err, results, fields) {
                if (err || results.length <= 0 || results[0].length <= 0) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                }
                let info = results[0][0]
                if (info.error_occurred === 1) {
                    return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, info.error_description, info.error_code))
                }

                data.userId = info.user_id
                data.status = info.user_status
                callback()
            }
        )
    },
    updateUserProfile: function (userId, updatedUserId, updatedFields, updatedBy, callback) {
        async.series(
            [
                callback => {
                    product.validateAuthenticationInformation(updatedFields, callback)
                },
                callback => {
                    role.validateRoleId(userId, updatedFields.roleId, callback)
                },
                callback => {
                    if (!updatedFields.routeId) return callback()
                    routes.checkIfRouteExists(updatedFields.routeId, callback)
                },
                callback => {
                    let pattern = queries.keyForSessionId(updatedUserId, "*")
                    common.deleteRedisKey(pattern, callback)
                },
                callback => {
                    updateUser(updatedUserId, updatedFields, updatedBy, callback)
                }
            ],
            err => {
                if (err) {
                    return callback(err)
                }

                callback()
            }
        )
    },
    checkIfUserCurrencyIsActive: function (userId, callback) {
        db.mysql.query(queries.checkIfUserCurrencyIsActive, [userId], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            if (results[0].status === 0) {
                return callback(
                    resGen.responseGenerator(resGen.ACTION_FAILED_ERR, `Currency is not active for user id [${userId}]`, resDet.CURRENCY_NOT_ACTIVE)
                )
            }

            return callback()
        })
    },
    checkIfRawPasswordIsCorrect: function (rawPassword, givenPassword, callback) {
        if (rawPassword !== givenPassword) {
            return callback(resGen.responseGenerator(resGen.AUTH_ERR, "Password does not match", resDet.PASSWORD_NOT_MATCH))
        }

        return callback()
    },
    getContactUserInfo: function (userId, container, callback) {
        db.mysql.query(queries.contactUserInfo, [userId], (err, results, fields) => {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            if (results.length === 0) {
                return callback(resGen.responseGenerator(resGen.NOT_FOUND, "Incorrect Platform User-Id"))
            }

            Object.assign(container, results[0])
            return callback()
        })
    },
    getUserContactList: function (data, callback) {
        let replacements = cfg.roleIdsForContactUser || []
        if (replacements.length === 0) return callback()

        db.mysql.query(queries.userContactList, [replacements], (err, results, fields) => {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            data.push(...results)
            return callback()
        })
    },
    /*
This function updates user role .
*/
    updateUserRole: function (roleId, userID, result, callback) {
        db.mysql.query(queries.updateUserRoleQuery, [roleId, userID], (err, results, fields) => {
            return callback
        })
    },
    updateUserAppTokenFunc: function (userId, updatedBy, appToken, callback) {
        db.mysql.query(queries.updateUserAppToken, [appToken, updatedBy, userId], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            if (results.affectedRows === 0) {
                return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, "User app token did not updated", resDet.USER_APP_TOKEN_UPDATE_FAILED))
            }

            callback()
        })
    },
    checkAuthorizationForB2bServices: function (userInfo, givenPassword, givenParentId, callback, options) {
        let calculatedHashedPassword = crypto.createHash("md5").update(givenPassword).digest("hex")

        if (calculatedHashedPassword !== userInfo.password) {
            return failedLogInAttemptCheck(userInfo.userId, userInfo.username, userInfo.failedLoginAttempt, userInfo.status, callback)
        }

        if (moment(userInfo.passwordExpiry).toDate().getTime() < new Date().getTime()) {
            return callback(resGen.responseGenerator(resGen.ACCESS_PERIOD_OVER, "Password expired", resDet.PASSWORD_EXPIRED))
        }

        if (userInfo.status !== "Active") {
            return callback(resGen.responseGenerator(resGen.AUTH_ERR, "User is currently in " + userInfo.status + " state", resDet.NO_ACTIVE_USER))
        }
        if (userInfo.userId !== givenParentId) {
            return callback(resGen.responseGenerator(resGen.AUTH_ERR, "You are not authorized to do the operation", resDet.PERMISSION_DENIED))
        }

        callback()
    },
    checkAuthorizationForB2bServicesByHashPassword: function (userInfo, givenPassword, callback, options) {
        if (givenPassword !== userInfo.password) {
            return failedLogInAttemptCheck(userInfo.userId, userInfo.username, userInfo.failedLoginAttempt, userInfo.status, callback)
        }

        if (moment(userInfo.passwordExpiry).toDate().getTime() < new Date().getTime()) {
            return callback(resGen.responseGenerator(resGen.ACCESS_PERIOD_OVER, "Password expired", resDet.PASSWORD_EXPIRED))
        }

        if (userInfo.status !== "Active") {
            return callback(resGen.responseGenerator(resGen.AUTH_ERR, "User is currently in " + userInfo.status + " state", resDet.NO_ACTIVE_USER))
        }
        callback()
    },
    retrieveUserWalletInformation: function (userInfo, walletDetails, callback) {
        db.mysql.query(queries.retrieveUserWalletDetailsByUserId, [userInfo.userId, userInfo.userId], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            if (results.length === 0) {
                return callback()
            } else {
                Object.assign(walletDetails, results)
                return callback()
            }
        })
    },
    fetchSpecificMenuInfo: function (input, menuDetails, callback) {
        db.mysql.query(queries.specificUserMenuInfo, [input[0].clientApp, input[0].roleId, input[0].currencyId], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            if (results.length === 0) {
                return callback(resGen.responseGenerator(resGen.NOT_FOUND, "No menu found for this user"))
            }
            Object.assign(menuDetails, results)

            return callback()
        })
    },

    retrieveUserInfoForgetPassword: function (input, userInfo, data, callback) {
        db.mysql.query(queries.retrieveUserInfoForgetPassword, [input.username], function (err, results, fields) {
            if (err) {
                console.log(err)
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            if (results.length === 0) {
                return callback(resGen.responseGenerator(resGen.NOT_FOUND, "No user  found"))
            }
            Object.assign(userInfo, results[0])

            return callback()
        })
    },
    formatUserMobileNumber: function (request, userInfo, data, callback) {
        try {
            let mobile_number = userInfo.countryCode + userInfo.mobileNo
            let length = mobile_number.length
            let lastFourPartnert = mobile_number.slice(length - 4, length)
            let firstTwoPartnert = mobile_number.slice(0, 2)
            let maskedMobileNumber = ""
            for (let i = 2; i < length - 4; i++) {
                maskedMobileNumber = maskedMobileNumber + "*"
            }
            maskedMobileNumber = firstTwoPartnert + maskedMobileNumber + lastFourPartnert
            let info = {
                mobileNumberForView: maskedMobileNumber,
                countryCode: userInfo.countryCode,
                mobileNumber: userInfo.mobileNo
            }
            Object.assign(data, info)
            return callback()
        } catch (e) {
            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, e))
        }
    },
    forgetPassword: function (input, userInfo, callback) {
        db.mysql.query(queries.retrieveUserInfoForgetPassword, [input.username], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            if (results.length === 0) {
                return callback(resGen.responseGenerator(resGen.NOT_FOUND, "No user  found"))
            }
            Object.assign(userInfo, results[0])

            return callback()
        })
    },
    retrieveUserInformationUsingIdForPromotions: function (userId, userInfo, callback) {
        db.mysql.query(queries.userInfoUsingIdForPromotions, [userId], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            if (results.length === 0) {
                return callback(resGen.responseGenerator(resGen.AUTH_ERR, "UserId does not match", resDet.NO_USER_FOUND))
            }

            if (results[0].roleStatus !== 1) {
                return callback(resGen.responseGenerator(resGen.AUTH_ERR, "User does not have any active role", resDet.NO_ACTIVE_ROLE_FOR_USER))
            }

            delete results[0].roleStatus
            Object.keys(results[0]).forEach(key => (userInfo[key] = results[0][key]))
            callback()
        })
    },
    referralUserRegistration: function ({ userId, fullName, mobileNo, email, parentToken }, resp, callback) {
        let payload = {
            access_token: cfg.referralCommission.accessToken,
            full_name: fullName,
            msisdn: mobileNo,
            username: userId,
            email: email,
            ref_user_token: parentToken
        }
        payload = Object.keys(payload)
            .filter(key => payload[key] !== undefined)
            .map(key => key + "=" + payload[key])
            .join("&")
        request(
            {
                url: `${cfg.referralCommission.baseUrl}/webhook/referUserRegistration`,
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: payload
            },
            function (err, response, body) {
                if (err) {
                    cfg.logger.error(err)
                }

                // cfg.logger.info(`[Referral User Registration] Request: ${payload}, Response: ${body}`)

                const parsed = JSON.parse(body)
                Object.assign(resp, parsed)
                callback()
            }
        )
    },
    createDynamicLink: function ({ platformUserId, apiKey, dynamicLinkInfo }, resp, callback) {
        const linkInfo = Object.assign({}, dynamicLinkInfo)
        linkInfo.link = `${linkInfo.link}&platformUserId=${platformUserId}`

        let payload = JSON.stringify(linkInfo)
        request(
            {
                url: `https://firebasedynamiclinks.googleapis.com/v1/shortLinks?key=${apiKey}`,
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                json: true,
                body: {
                    dynamicLinkInfo: linkInfo
                }
            },
            function (err, response, body) {
                if (err) {
                    cfg.logger.error(err)
                }

                // cfg.logger.info(`[Dynamic Link generation] Request: ${payload}, Response: ${JSON.stringify(body)}`)

                Object.assign(resp, {
                    shortLink: body["shortLink"]
                })
                callback()
            }
        )
    },
    incrementReferralCount: function ({ userId, username }, callback) {
        db.mysql.query(queries.incrementReferralCount, [username, userId], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            callback()
        })
    },
    updateUserReferredBy: function ({ userId, referredUserId }, callback) {
        db.mysql.query(queries.updateUserReferredBy, [referredUserId, userId], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }
            if (results.affectedRows == 0) {
                results.message = "This user has been already referred."
                return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, results))
            }

            callback()
        })
    },
    updateAppUserInfoOnSignUp: function ({ userId, installationSource, campaignName }, callback) {
        db.mysql.query(queries.updateAppUserInfoOnSignUp, [installationSource, campaignName, userId], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            callback()
        })
    },
    findNearbyAgents: function ({ latitude, longitude }, data, callback) {
        const distanceUnit = 111.045
        const allowedRoleIds = [2, 4, 5, 18]

        let radius = 5.0
        let maxNoOfAgents = 100
        async.series(
            [
                callback => {
                    db.mysql.query(queries.nearbyAgentSearchParams, [], function (err, results, fields) {
                        if (err) {
                            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                        }

                        for (const result of results) {
                            if (result.name === "maxRadiusForNearbyAgentSearch") {
                                radius = Number(result.value)
                            }

                            if (result.name === "maxAgentsForNearbyAgentSearch") {
                                maxNoOfAgents = Number(result.value)
                            }
                        }

                        return callback()
                    })
                },
                callback => {
                    db.mysql.query(
                        queries.nearbyAgents(latitude, longitude, radius, distanceUnit, maxNoOfAgents),
                        [allowedRoleIds],
                        function (err, results, fields) {
                            if (err) {
                                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                            }

                            data.push(...results)
                            callback()
                        }
                    )
                }
            ],
            err => {
                if (err) {
                    return callback(err)
                }

                return callback()
            }
        )
    },
    fetchUsersRole: function (userIds, data, callback) {
        db.mysql.query(queries.usersRole, [userIds], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            const usersRole = {}
            for (const result of results) {
                usersRole[result.platformUserId] = result
            }
            for (const userId of userIds) {
                usersRole[userId] && data.push(usersRole[userId])
            }
            callback()
        })
    },
    verifyUser: function ({ srcuid, srcpwd }, callback) {
        let userInfo = {}
        async.series(
            [
                callback => {
                    this.getUserByUsernameOrId(srcuid, userInfo, callback)
                },
                callback => {
                    this.checkAuthorization(userInfo, srcpwd, callback)
                }
            ],
            err => {
                if (err) {
                    return callback(err)
                }
                return callback()
            }
        )
    },
    requestSecurityDepositRefund: function (argu, callback) {
        db.mysql.query(
            queries.createRefundRequest,
            [argu.userId, argu.requestReason, argu.securityDepositAmount, argu.userId],
            function (err, results, fields) {
                if (err) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                }
                if (results.affectedRows == 0) {
                    return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, "This user has already requested for security deposit amount"))
                }

                return callback()
            }
        )
    },

    processRefundRequest: function (argu, callback) {
        db.mysql.query(
            queries.updateRefundRequestApproval,
            [argu.userId, argu.actionReason, argu.status, argu.refundRequestId],
            function (err, results, fields) {
                if (err) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                }
                if (results.affectedRows == 0) {
                    return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, "Invalid refund request id"))
                }

                return callback()
            }
        )
    },

    proceedFundTransfer: function (argu, callback) {
        let fundTransferData = {
            transferType: 20,
            refId: "",
            userId: argu.userId,
            amount: argu.amount,
            channel: "api",
            username: argu.userName,
            walletTypeId: -1,
            productId: "",
            packageId: ""
        }
        fundTransfer.fundTransferBySystem(fundTransferData, {}, callback)
    },

    getUserInfoByUserId: function (userId, userInfo, callback) {
        db.mysql.query(queries.specificUserInfoByUserId, [userId], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            if (results.length === 0) {
                return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, "Insufficient security deposit amount", resDet.PERMISSION_DENIED))
            }
            Object.assign(userInfo, {
                securityDepositAmount: results[0].security_deposit_amount
            })
            //console.log("userinfo is ", userInfo);
            callback()
        })
    },

    fetchUserInfoUsingReferenceId: function (id, requestedUserInfo, callback) {
        db.mysql.query(queries.getUserInfoByReferenceId, [id], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            if (results.length === 0) {
                return callback(resGen.responseGenerator(resGen.NOT_FOUND, "No request issued with the reference id"))
            }
            Object.assign(requestedUserInfo, {
                userId: results[0].user_id,
                securityDepositAmount: results[0].security_deposit_amount
            })
            //console.log("userinfo is ", userInfo);
            callback()
        })
    },

    checkAlreadyApproved: function (id, callback) {
        db.mysql.query(queries.checkStatus, [id], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }
            if (results.length > 0) {
                return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, "Request already approved"))
            }

            return callback()
        })
    },

    updateUserInfo: function (id, callback) {
        db.mysql.query(queries.userSecurityDepositUpdate, [id], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }
            if (results.affectedRows == 0) {
                return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, "Invalid user id"))
            }

            return callback()
        })
    },

    updatePhoneNumber: function ({ userId, mobileNo, countryCode }, resulData, callback) {
        async.series(
            [
                callback => {
                    db.mysql.query(queries.fetchUserPhoneWithCountryCode, [userId], function (err, results, fields) {
                        if (err) {
                            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                        }
                        if (results.length > 0) {
                            Object.assign(resulData, {
                                user_name: results[0].user_name,
                                prev_phone_no: results[0].user_mobileno,
                                prev_country_code: results[0].user_country_code
                            })
                        }
                        callback()
                    })
                },
                callback => {
                    db.mysql.query(queries.updatePhoneNumber, [mobileNo, countryCode, userId], function (err, results, fields) {
                        if (err) {
                            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                        }
                        if (results.affectedRows == 0) {
                            console.log("no rows affected")
                            return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, "User phone number did not update"))
                        }
                        Object.assign(resulData, {
                            message: "Successfully updated user phone number"
                        })
                    })
                    callback()
                }
            ],
            err => {
                if (err) {
                    return callback(err)
                }
                return callback()
            }
        )
    },

    createPhoneNumberUpdateEntry: function (requestData, resultData, callback) {
        db.mysql.query(
            queries.insertPhoneUpdateLog,
            [requestData.userId, requestData.countryCode + requestData.mobileNo, resultData.prev_country_code + resultData.prev_phone_no, resultData.user_name],
            function (err, results, fields) {
                if (err) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                }
                delete resultData.user_name
                delete resultData.prev_country_code
                delete resultData.prev_phone_no

                callback()
            }
        )
    },

    updateUserEmail: function ({ email, userId }, resultData, callback) {
        console.log("Email, userId: ", email, userId)
        db.mysql.query(queries.updateEmail, [email, userId], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }
            if (results.affectedRows == 0) {
                return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, "User email did not update"))
            }
            Object.assign(resultData, {
                message: "Successfully updated user email"
            })

            return callback()
        })
    },

    refundUserHistory: function (id, resultData, callback) {
        db.mysql.query(queries.refundUserHistory, [id], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }
            if (results.length == 0) {
                return callback(resGen.responseGenerator(resGen.NOT_FOUND, "No record found with that user id"))
            }

            Object.assign(resultData, results)
            // for(let i=0; i<results.length; i++){
            //     Object.keys(results[i]).forEach(key => resultData[key] = results[i][key]);
            // }
            //resultData = [...results];
            return callback()
        })
    },

    validateJompayIssue: function (issueId, container, callback) {
        db.mysql.query(queries.validateJompayIssue, [issueId], function (err, results, fields) {
            if (err) {
                console.error("validateJompayIssue DB exception: ", err)
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }
            if (results.length === 0) {
                return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, "No valid records found with this ID"))
            }
            Object.assign(container, results[0])
            return callback()
        })
    },

    processJompayPaymentIssue: function ({ status, reason, userId, issueId }, { username }, jompayIssueInfo, notifyCallback, callback) {
        let issueRequest = {}
        let data = {}
        async.series(
            [
                callback => {
                    issueRequest = {
                        transferType: 0,
                        currencyId: 1,
                        channel: "",
                        amount: jompayIssueInfo.amount,
                        username: username
                    }

                    if (status === "approved") {
                        issueRequest.transferTo = jompayIssueInfo.transfer_to
                        issueRequest.transferFrom = jompayIssueInfo.transfer_from

                        console.log("Jompay Issue Info: ", jompayIssueInfo)
                        this.executeFundTransferRequest(issueRequest, jompayIssueInfo, 1, data, callback)
                    } else if (status === "rejected") {
                        issueRequest.transferTo = jompayIssueInfo.freezed_id
                        issueRequest.transferFrom = jompayIssueInfo.transfer_from
                        issueRequest.transferTo === 0 ? callback() : this.executeFundTransferRequest(issueRequest, jompayIssueInfo, 0, data, callback)
                    }
                },
                callback => {
                    db.mysql.query(queries.updateJompayIssue, [reason, status, userId, issueId], (err, results, fields) => {
                        if (err) {
                            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                        }
                        notifyCallback()
                    })
                }
            ],
            err => {
                if (err) return callback(err)
                return callback()
            }
        )
    },

    handleJompayTransactionLimitAction: function ({ status, reason, userId, issueId }, jompayIssueInfo, callback) {
        async.series(
            [
                callback => {
                    // console.log("jompayIssueInfo: ", jompayIssueInfo)

                    if (moment().isBefore(jompayIssueInfo.executionEnableAt))
                        return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, "Execution time for this issue is not enabled yet"))

                    if (status === "approved") this.approveJompayTransactionLimitIssue(jompayIssueInfo, callback)
                    else return callback()
                },
                callback => {
                    db.mysql.query(queries.updateJompayIssue, [reason, status, userId, issueId], (err, results, fields) => {
                        if (err) {
                            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                        }
                        return callback()
                    })
                }
            ],
            err => {
                if (err) return callback(err)
                return callback()
            }
        )
    },

    approveJompayTransactionLimitIssue: function (jompayIssueInfo, callback) {
        let orderInfo = {}
        let commissionDetails = {}
        let data = {}
        let transactionCommissionId = {}
        let roleWiseTransferLimitDetails = {}

        const platformUserId = jompayIssueInfo.transfer_to
        const originalAmount = jompayIssueInfo.amount

        async.series(
            [
                callback => {
                    order.checkOrderRequest(
                        {
                            productId: cfg.jompay.productId,
                            amount: originalAmount,
                            salesAmount: -1,
                            currencyId: -1,
                            userId: platformUserId,
                            checkUserBalance: 0
                        },
                        orderInfo,
                        callback
                    )
                },
                callback => {
                    fundTransfer.getCommissionDetails(
                        {
                            userId: platformUserId,
                            transferType: cfg.jompay.transferType,
                            commission: orderInfo.comission,
                            productId: cfg.jompay.productId,
                            channel: "jompay"
                        },
                        commissionDetails,
                        err => {
                            return callback()
                        }
                    )
                },
                callback => {
                    fundTransfer.fundTransferBySystem(
                        {
                            userId: platformUserId,
                            transferType: cfg.jompay.transferType,
                            refId: jompayIssueInfo.salesOrderId,
                            amount: originalAmount,
                            productId: cfg.jompay.productId,
                            channel: "jompay",
                            username: jompayIssueInfo.transfer_to_user_name
                        },
                        data,
                        callback
                    )
                },
                callback => {
                    if (commissionDetails.beneficiary_id !== null) {
                        let userCommission = orderInfo.comission
                        fundTransfer.transactionCommissionDiverse(
                            {
                                beneficiaryId: commissionDetails.beneficiary_id,
                                cashTransactionId: data.transactionId,
                                cashAgentId: "",
                                productId: cfg.jompay.productId,
                                cashPlatformProductId: cfg.jompay.productId,
                                cashTransactionType: "Jompay Commission",
                                originalAmount: originalAmount - userCommission,
                                commission: userCommission,
                                cashStatus: 1,
                                cashRemarks: "JomPayUserID: " + platformUserId,
                                username: jompayIssueInfo.transfer_to_user_name
                            },
                            transactionCommissionId,
                            callback
                        )
                    } else {
                        return callback()
                    }
                },
                callback => {
                    if (transactionCommissionId.insertId) {
                        fundTransfer.fundTransferBySystem(
                            {
                                userId: commissionDetails.beneficiary_id,
                                transferType: cfg.jompay.transferType,
                                refId: transactionCommissionId.insertId,
                                amount: commissionDetails.beneficiary_amount,
                                productId: cfg.jompay.productId,
                                channel: "jompay",
                                username: "JomPayCommission"
                            },
                            {},
                            callback
                        )
                    } else {
                        return callback()
                    }
                },
                callback => {
                    this.getRoleWiseTransferLimit(jompayIssueInfo.transfer_to_role, "jompay", roleWiseTransferLimitDetails, callback)
                },
                callback => {
                    if (
                        Object.keys(roleWiseTransferLimitDetails).length === 1 &&
                        jompayIssueInfo.transfer_to_role === 7 &&
                        roleWiseTransferLimitDetails[0].lowerLimit <= originalAmount &&
                        originalAmount <= roleWiseTransferLimitDetails[0].higherLimit &&
                        roleWiseTransferLimitDetails[0].transfer_limit_channel == "jompay"
                    ) {
                        return this.updateUserRole(roleWiseTransferLimitDetails[0].newRole, platformUserId, callback)
                    }

                    return callback()
                },

                callback => {
                    let data = {
                        userId: platformUserId,
                        transactionAmount: originalAmount,
                        migrateType: "automatic"
                    }
                    userMigration.migrateUserRole(data, callback)
                }
            ],
            err => {
                if (err && err.errorType != "migrateUserRole") return callback(err)

                return callback()
            }
        )
    },

    executeFundTransferRequest: function (request, jompayIssueInfo, status, data, callback) {
        const transferTo = status ? jompayIssueInfo.transfer_to : jompayIssueInfo.freezed_id
        const fundTransferInfo = {
            [transferTo]: {
                id: status ? jompayIssueInfo.transfer_to : jompayIssueInfo.freezed_id,
                roleId: status ? jompayIssueInfo.transfer_to_role : jompayIssueInfo.freezed_role,
                currencyId: status ? jompayIssueInfo.transfer_to_currency : jompayIssueInfo.freezed_currency
            },
            [jompayIssueInfo.transfer_from]: {
                id: jompayIssueInfo.transfer_from,
                roleId: jompayIssueInfo.transfer_from_role,
                currencyId: jompayIssueInfo.transfer_from_currency
            }
        }

        // console.info("JompayIssue FundTransfer Info: ", fundTransferInfo);
        async.series(
            [
                callback => {
                    fundTransfer.executeFundTransferProcedure(false, fundTransferInfo, request, data, callback)
                }
            ],
            err => {
                if (err) return callback(err)
                return callback()
            }
        )
    },

    getRoleWiseTransferLimit: function (fromRoleId, channel, roleWiseTransferLimitDetails, callback) {
        db.mysql.query(fundTransferqueries.getRoleWiseTransferLimit, [fromRoleId, channel], (err, results, fields) => {
            Object.assign(roleWiseTransferLimitDetails, results)

            return callback()
        })
    },

    formatUserEmail: function (request, userInfo, data, callback) {
        try {
          let email = userInfo.email
          let emailParts = email.split('@')
          let localPartLength = 5
          let maskedLocalPart = email.slice(0, localPartLength) + '*****'
          let domainPart = emailParts[1]
          let maskedEmail = maskedLocalPart + '@' + domainPart
      
          let info = {
            emailForView: maskedEmail,
            email: userInfo.email,
            countryCode: userInfo.countryCode,
            mobileNumber: userInfo.mobileNo
          };
          Object.assign(data, info)
          return callback()
        } catch (e) {
          return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, e))
        }
      },

      retrieveUserInfoUsingMobileNo: function (input, userInfo, data, callback) {
        db.mysql.query(queries.retrieveUserInfoByPhone, [input.mobileNo], function (err, results, fields) {
            if (err) {
                console.log(err)
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            if (results.length === 0) {
                return callback(resGen.responseGenerator(resGen.NOT_FOUND, "No user  found"))
            }
            Object.assign(userInfo, results[0])

            return callback()
        })
	  },
	addUserEmail: function ({ email, userId }, resultData, callback) {
		db.mysql.query(queries.addUserEmail, [email, userId], function (err, results, fields) {
			if (err) {
				return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
			}

			if (results.affectedRows == 0) {
				return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, "User email did not update"))
			}

			Object.assign(resultData, {
				message: "Your email updated successfully"
			})

			return callback()
		})
	},

	checkUserEmail: function (currentEmail, userId, callback) {
		db.mysql.query(queries.checkUserEmail, [currentEmail, userId], function (err, results, fields) {
			if (err) {
				return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
			} 

			if (results.length === 0) {
				return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, "Email not found for the given user ID"));
			}
			return callback(null, results[0]);
		})
	},

	checkPlatformUserPassword: function(password, userId, callback) {
		db.mysql.query(queries.checkUserPassword, [password, userId], function (err, results, fields) {
			console.log('RESULT OF QUERY | ', results)
			if (err) {
				return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
			}

			if (results.length === 0) {
				return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, "Password mismatch"));
			}
			return callback(null, results[0]);
		})
	},

	updatePlatformUserEmail: function ({ userId, currentEmail, newEmail }, resultData, callback) {
		db.mysql.query(queries.updateUserEmail, [currentEmail, newEmail, userId], function (err, results, fields) {
			// console.log('updated email')
			if (err) {
				return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
			}
			if (results.affectedRows == 0) {
				return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, "User email did not update"));
			}
			Object.assign(resultData, {
				message: "Successfully updated user email"
			})

			return callback();
		})
	},

	checkUserStatus: function ( userId , callback) {
		db.mysql.query(queries.checkPlatformUserStatus, [userId], function (err, results, fields) {
			console.log('RESULT |', results)
			if (err) {
				return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
			}

			if (results.length == 0) {
				return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, "User not found"));
			}

			const userInfo = results[0]

			if (userInfo.user_status != 'Active') {
				return callback(resGen.responseGenerator(resGen.AUTH_ERR, "User is currently in " + userInfo.user_status + " state", resDet.NO_ACTIVE_USER));
			}

			return callback(null, results[0]);
		})
	}
}