"use strict"

const express = require("express")
const async = require("async")
const moment = require("moment")
const crypto = require("crypto")

const common = require("../components/common")
const user = require("../components/user")
const product = require("../components/product")
const order = require("../components/order")
const role = require("../components/role")
const rolePermission = require("../lib/role.permission")

const resGen = require("../lib/result.codes")
const resDet = require("../lib/result.details")
const utils = require("../lib/utils")
const userMigration = require("../components/user_migration")
const userDeviceService = require("../components/user_device")
const wallet = require("../components/wallet")

const cfg = require("../config")

const router = express.Router()

const callback = common.callback

router.post("/verify-session", function (req, res) {
    let data = {}
    async.series(
        [
            callback => {
                common.verifySession(req.body.userId, req.body.sessionId, callback, undefined, req.headers.referer, false)
            },
            callback => {
                user.getTTLForSessionId(req.body.userId, req.body.sessionId, data, callback)
            }
        ],
        err => {
            if (err) {
                return callback(err, req, res, data)
            }

            callback(null, req, res, data)
        }
    )
})
router.post("/sign-up", function (req, res) {
    let hashedPassword
    let data = {}
    async.series(
        [
            callback => {
                hashedPassword = crypto.createHash("md5").update(req.body.password).digest("hex")
                callback()
            },
            callback => {
                user.executeSignUpProcedure(req.body, hashedPassword, data, callback)
            }
        ],
        err => {
            if (err) {
                return callback(err, req, res, data)
            }

            callback(null, req, res, data)
        }
    )
})

router.post("/sign-up/app", function (req, res) {
    let hashedPassword
    let data = {}
    let otpVerifyResult = {}

    let otpInfo = {
        purpose: "sign-up",
        userId: req.body.mobileNo,
        otp: req.body.otp
    }

    async.series(
        [
            callback => {
                delete req.body.purpose
                delete req.body.userId
                delete req.body.otp
                common.validateOtpforSpecificPurpose(otpInfo, otpVerifyResult, callback)
            },
            callback => {
                common.deleteOtpforSpecificPurpose(otpInfo, callback)
            },
            callback => {
                hashedPassword = crypto.createHash("md5").update(req.body.password).digest("hex")
                callback()
            },
            callback => {
                user.validateExistingUserStatus(req.body, callback)
            },
            callback => {
                user.executeSignUpProcedureApp(req.body, hashedPassword, data, callback)
            },
            callback => {
                user.updateAppUserInfoOnSignUp(
                    {
                        userId: data.userId,
                        installationSource: req.body.src,
                        campaignName: req.body.cmp
                    },
                    callback
                )
            }
        ],
        err => {
            if (err) {
                return callback(err, req, res, data)
            }

            callback(null, req, res, data)
        }
    )
})

router.post("/login", function (req, res) {
    let data = {}
    let userInfo = {}
    let walletDetails = []
    let deviceContainer = {}
    async.series(
        [
            callback => {
                user.retrieveUserInformation(req.body.username, userInfo, callback)
            },
            callback => {
                if (req.body.appName && req.body.appName === "agent" && cfg.agentAppDisableRoleId && cfg.agentAppDisableRoleId.includes(userInfo.roleId))
                    return callback(resGen.responseGenerator(resGen.AUTH_ERR, "You are not authorized. Please communicate with our support."))
                else if (req.body.appName && req.body.appName === "user" && cfg.userAppDisableRoleId && cfg.userAppDisableRoleId.includes(userInfo.roleId))
                    return callback(resGen.responseGenerator(resGen.AUTH_ERR, "Unauthorized"))
                else return callback()
            },
            callback => {
                user.retrieveUserWalletInformation(userInfo, walletDetails, callback)
            },
            callback => {
                userInfo.walletDetails = walletDetails
                let calculatedHashedPassword = crypto.createHash("md5").update(req.body.password).digest("hex")
                if (calculatedHashedPassword !== userInfo.password) {
                    return user.failedLogInAttemptCheck(userInfo.userId, req.body.username, userInfo.failedLoginAttempt, userInfo.status, callback)
                }

                if (moment(userInfo.passwordExpiry).toDate().getTime() < new Date().getTime()) {
                    let expiryData = {}
                    return common.createSession(userInfo, expiryData, err => {
                        if (err) {
                            return callback(err)
                        }

                        expiryData.userId = userInfo.userId
                        return callback(resGen.responseGenerator(resGen.ACCESS_PERIOD_OVER, undefined, resDet.PASSWORD_EXPIRED, undefined, expiryData))
                    })
                }

                if (userInfo.status !== "Active") {
                    return callback(resGen.responseGenerator(resGen.AUTH_ERR, "User is currently in " + userInfo.status + " state", resDet.NO_ACTIVE_USER))
                }

                callback()
            },
            callback => {
                if (userInfo.loginEmailAuthentication) {
                    let info = {
                        purpose: "login",
                        userId: userInfo.userId,
                        username: req.body.username,
                        receiver: userInfo.email
                    }
                    data.loginEmailAuthentication = true
                    return common.sendOtpEmail(info, data, callback)
                }

                delete userInfo.password
                delete userInfo.passwordExpiry
                delete userInfo.status
                delete userInfo.failedLoginAttempt
                data = userInfo
                callback()
            },
            callback => {
                if (!userInfo.loginEmailAuthentication) {
                    userInfo.rolePermissions = {}
                    return role.retrieveRolePermission({ roleId: userInfo.roleId }, userInfo.rolePermissions, callback)
                }
                callback()
            },
            callback => {
                if (!userInfo.loginEmailAuthentication) {
                    return user.updateLastLoginTime(userInfo.userId, req.body.username, callback)
                }
                callback()
            },
            callback => {
                if (!userInfo.loginEmailAuthentication) {
                    return common.createSession(userInfo, data, callback)
                }
                callback()
            },
            callback => {
                if (cfg.userDevice.isEnable && userInfo.userId !== 99637) {
                    userDeviceService.userDeviceServiceProvider(req, data, deviceContainer, callback)
                } else {
                    callback()
                }
            }
        ],
        err => {
            if (err) {
                let details = undefined
                if (userInfo.status && userInfo.status.toLowerCase() !== "active") {
                    details = `You are in ${userInfo.status} mode. Please contact support`
                }
                err = resGen.finalizeResponse(err, { offset: resDet.offset.platform, details: details })
                return callback(err, req, res, data)
            }
            delete userInfo.rolePermissions
            data.userDevice = { ...deviceContainer }
            callback(null, req, res, data)
        }
    )
})

router.post("/admin/login", function (req, res) {
  let data = {};
  let userInfo = {};
  let walletDetails = [];
  let deviceContainer = {};

  const allowedAdminLoginRoleIDs = [1, 6, 9];

  async.series(
    [
      (callback) => {
        user.retrieveUserInformation(req.body.username, userInfo, callback);
      },
      (callback) => {
        // This code prevents users from logging in unless they have an Admin, Support, or Manager role.
        if (!allowedAdminLoginRoleIDs.includes(userInfo.roleId)) {
          return callback(
            resGen.responseGenerator(resGen.AUTH_ERR, "Unauthorized")
          );
        }

        return callback();
      },
      (callback) => {
        user.retrieveUserWalletInformation(userInfo, walletDetails, callback);
      },
      (callback) => {
        userInfo.walletDetails = walletDetails;
        let calculatedHashedPassword = crypto
          .createHash("md5")
          .update(req.body.password)
          .digest("hex");
        if (calculatedHashedPassword !== userInfo.password) {
          return user.failedLogInAttemptCheck(
            userInfo.userId,
            req.body.username,
            userInfo.failedLoginAttempt,
            userInfo.status,
            callback
          );
        }

        if (
          moment(userInfo.passwordExpiry).toDate().getTime() <
          new Date().getTime()
        ) {
          let expiryData = {};
          return common.createSession(userInfo, expiryData, (err) => {
            if (err) {
              return callback(err);
            }

            expiryData.userId = userInfo.userId;
            return callback(
              resGen.responseGenerator(
                resGen.ACCESS_PERIOD_OVER,
                undefined,
                resDet.PASSWORD_EXPIRED,
                undefined,
                expiryData
              )
            );
          });
        }

        if (userInfo.status !== "Active") {
          return callback(
            resGen.responseGenerator(
              resGen.AUTH_ERR,
              "User is currently in " + userInfo.status + " state",
              resDet.NO_ACTIVE_USER
            )
          );
        }

        callback();
      },
      (callback) => {
        if (userInfo.loginEmailAuthentication) {
          let info = {
            purpose: "login",
            userId: userInfo.userId,
            username: req.body.username,
            receiver: userInfo.email,
          };
          data.loginEmailAuthentication = true;
          return common.sendOtpEmail(info, data, callback);
        }

        delete userInfo.password;
        delete userInfo.passwordExpiry;
        delete userInfo.status;
        delete userInfo.failedLoginAttempt;
        data = userInfo;
        callback();
      },
      (callback) => {
        if (!userInfo.loginEmailAuthentication) {
          userInfo.rolePermissions = {};
          return role.retrieveRolePermission(
            { roleId: userInfo.roleId },
            userInfo.rolePermissions,
            callback
          );
        }
        callback();
      },
      (callback) => {
        if (!userInfo.loginEmailAuthentication) {
          return user.updateLastLoginTime(
            userInfo.userId,
            req.body.username,
            callback
          );
        }
        callback();
      },
      (callback) => {
        if (!userInfo.loginEmailAuthentication) {
          return common.createSession(userInfo, data, callback);
        }
        callback();
      },
      (callback) => {
        if (cfg.userDevice.isEnable && userInfo.userId !== 99637) {
          userDeviceService.userDeviceServiceProvider(
            req,
            data,
            deviceContainer,
            callback
          );
        } else {
          callback();
        }
      },
    ],
    (err) => {
      if (err) {
        let details = undefined;
        if (userInfo.status && userInfo.status.toLowerCase() !== "active") {
          details = `You are in ${userInfo.status} mode. Please contact support`;
        }
        err = resGen.finalizeResponse(err, {
          offset: resDet.offset.platform,
          details: details,
        });
        return callback(err, req, res, data);
      }
      delete userInfo.rolePermissions;
      data.userDevice = { ...deviceContainer };
      callback(null, req, res, data);
    }
  );
})

router.post("/user/device/registration", function (req, res) {
    let data = []
    let deviceExists = {}
    let maxDevices = {}
    async.series(
        [
            callback => {
                common.verifySession(req.body.userId, req.body.sessionId, callback, undefined, req.headers.referer)
            },
            callback => {
                userDeviceService.isDeviceRegistered(req, req.body, deviceExists, callback)
            },
            callback => {
                if (deviceExists.isAvailable && deviceExists.isAvailable === -1) {
                    return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, "Device already exists"))
                }
                userDeviceService.checkAvailability(req.body, maxDevices, callback)
            },
            callback => {
                if (maxDevices.isAvailable === 0) {
                    return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, "Exceeded maximum number of registered devices"))
                }
                const requestData = {
                    userId: req.body.userId,
                    deviceId: req.body.deviceId ? req.body.deviceId : req.headers["user-agent"],
                    deviceName: req.body.deviceId ? req.headers["user-agent"] : req.body.deviceName,
                    sessionId: req.body.sessionId
                }
                userDeviceService.addDevice(requestData, data, callback)
            }
        ],
        err => {
            if (err) {
                return callback(err, req, res, null)
            }
            callback(null, req, res, data)
        }
    )
})

router.post("/user/device/delete", function (req, res) {
    let data = []
    async.series(
        [
            callback => {
                common.verifySession(req.body.userId, req.body.sessionId, callback, undefined, req.headers.referer)
            },
            callback => {
                const requestData = {
                    userId: req.body.userId,
                    deviceId: req.body.deviceId,
                    sessionId: req.body.sessionId
                }
                userDeviceService.deleteDeviceWithSessions(requestData, data, callback)
            }
        ],
        err => {
            if (err) return callback(err, req, res, null)
            callback(null, req, res, data)
        }
    )
})

router.post("/user/device/list", function (req, res) {
    let data = []
    async.series(
        [
            callback => {
                common.verifySession(req.body.userId, req.body.sessionId, callback, undefined, req.headers.referer)
            },
            callback => {
                const requestData = {
                    userId: req.body.userId,
                    sessionId: req.body.sessionId
                }
                userDeviceService.getDeviceList(requestData, data, callback)
            }
        ],
        err => {
            if (err) {
                callback(err, req, res, null)
            }
            callback(null, req, res, data)
        }
    )
})

router.post("/get-user-info", function (req, res) {
    let data = []

    async.series(
        [
            callback => {
                common.verifySession(req.body.userId, req.body.sessionId, callback, undefined, req.headers.referer)
            },
            callback => {
                user.fetchSpecificUserInfo(req.body.userId, data, callback)
            },
            callback => {
                data[0].userBalance = data[0].balance
                delete data[0].balance
                callback()
            },
            callback => {
                user.modifyUserInformation(data, callback)
            }
        ],
        err => {
            if (err) {
                return callback(err, req, res, data)
            }

            callback(null, req, res, data)
        }
    )
})
router.post("/get-user-menu-info", function (req, res) {
    let data = []
    let menuDetails = []
    async.series(
        [
            callback => {
                common.verifySession(req.body.userId, req.body.sessionId, callback, undefined, req.headers.referer)
            },
            callback => {
                user.fetchSpecificUserInfo(req.body.userId, data, callback)
            },
            callback => {
                data[0].clientApp = req.body.clientApp
                data[0].userBalance = data[0].balance
                delete data[0].balance
                user.fetchSpecificMenuInfo(data, menuDetails, callback)
            }
        ],
        err => {
            if (err) {
                return callback(err, req, res, menuDetails)
            }

            callback(null, req, res, menuDetails)
        }
    )
})

router.post("/get-specific-user-info", function (req, res) {
    let data = []
    async.series(
        [
            callback => {
                common.verifySession(req.body.userId, req.body.sessionId, callback, undefined, req.headers.referer)
            },
            callback => {
                user.checkIfUserExists(req.body.queriedUserId, callback)
            },
            callback => {
                user.fetchSpecificUserInfo(req.body.queriedUserId, data, callback)
            },
            callback => {
                user.modifyUserInformation(data, callback)
            }
        ],
        err => {
            if (err) {
                return callback(err, req, res, data)
            }

            callback(null, req, res, data)
        }
    )
})

router.post("/product-auth-info", function (req, res) {
    let data = {}
    async.series(
        [
            callback => {
                common.verifySession(req.body.userId, req.body.sessionId, callback, undefined, req.headers.referer)
            },
            callback => {
                product.retrieveProductAuthInfo(req.body.userId, req.body.productCategoryId, data, callback)
            }
        ],
        err => {
            if (err) {
                return callback(err, req, res, data)
            }

            callback(null, req, res, data)
        }
    )
})

router.post("/logout", function (req, res) {
    async.series(
        [
            callback => {
                common.verifySession(req.body.userId, req.body.sessionId, callback, undefined, req.headers.referer)
            },
            callback => {
                common.deleteSession(req.body.userId, req.body.sessionId, callback)
            }
        ],
        err => {
            if (err) {
                return callback(err, req, res)
            }

            callback(null, req, res)
        }
    )
})

router.post("/change-password", function (req, res) {
    let data = {}
    let userInfo = {}
    let sessionInfo = {}
    let hashedPassword

    async.series(
        [
            callback => {
                common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer)
            },
            callback => {
                user.retrievePassword(req.body.userId, userInfo, callback)
            },
            callback => {
                let calculatedHashedPassword = crypto.createHash("md5").update(req.body.oldPassword).digest("hex")
                if (calculatedHashedPassword !== userInfo.user_pwd) {
                    return callback(resGen.responseGenerator(resGen.AUTH_ERR, "Password does not match", resDet.PASSWORD_NOT_MATCH))
                }

                callback()
            },
            callback => {
                hashedPassword = crypto.createHash("md5").update(req.body.newPassword).digest("hex")
                callback()
            },
            callback => {
                user.updatePassword(req.body.userId, sessionInfo["username"], hashedPassword, callback)
            },
            callback => {
                common.deleteSession(req.body.userId, req.body.sessionId, callback)
            }
        ],
        err => {
            if (err) {
                return callback(err, req, res, data)
            }

            callback(null, req, res, data)
        }
    )
})

router.post("/get-user-list", function (req, res) {
    let data = []

    async.series(
        [
            callback => {
                common.verifySession(req.body.userId, req.body.sessionId, callback, undefined, req.headers.referer)
            },
            callback => {
                user.getUserList(req.body.userId, data, callback)
            }
        ],
        err => {
            if (err) {
                return callback(err, req, res)
            }

            return callback(null, req, res, data)
        }
    )
})

router.post("/get-reseller-list", function (req, res) {
    let data = []
    // let whereClause = req.body.userId;
    let whereClause = ""

    async.series(
        [
            callback => {
                common.verifySession(req.body.userId, req.body.sessionId, callback, undefined, req.headers.referer)
            },
            callback => {
                if (req.query.userId) {
                    whereClause += ` and u.user_id = ${req.query.userId}`
                }
                if (req.query.userName) {
                    whereClause += ` and u.user_name LIKE '%${req.query.userName}%'`
                }
                if (req.query.fullName) {
                    whereClause += ` and u.user_full_name LIKE '%${req.query.fullName}%'`
                }
                if (req.query.roleId) {
                    whereClause += ` and u.user_role_id = ${req.query.roleId}`
                }
                console.log("WhereClause is", whereClause)
                // user.getResellerList(req.body.userId, data, callback);
                user.getResellerList(req.body.userId, data, callback, whereClause)
            }
        ],
        err => {
            if (err) {
                return callback(err, req, res)
            }

            return callback(null, req, res, data)
        }
    )
})

router.post("/get-cash-agent-list", function (req, res) {
    let data = []

    async.series(
        [
            callback => {
                common.verifySession(req.body.userId, req.body.sessionId, callback, undefined, req.headers.referer)
            },
            callback => {
                user.getCashAgentList(data, callback)
            }
        ],
        err => {
            if (err) {
                return callback(err, req, res)
            }

            return callback(null, req, res, data)
        }
    )
})

router.post("/profile-update", function (req, res) {
    let sessionInfo = {}
    let userInfo = {}
    let data = []

    async.series(
        [
            callback => {
                common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer)
            },
            callback => {
                user.validateAuthenticationInformation(req.body.updatedFields, callback)
            },
            callback => {
                if (!req.body.updatedFields.resources) return callback()

                user.retrieveUserInformationUsingId(req.body.userId, userInfo, callback)
            },
            callback => {
                user.updateUser(req.body.userId, req.body.updatedFields, sessionInfo["username"], callback)
            },
            callback => {
                let paths = []
                let resourceUpdatedFields = userResourceUpdatedFields(req.body.updatedFields.resources)
                !resourceUpdatedFields.profile || !userInfo.profilePicture || paths.push(cfg.fileRootDirectory + userInfo.profilePicture)
                !resourceUpdatedFields.passport || !userInfo.passportPicture || paths.push(cfg.fileRootDirectory + userInfo.passportPicture)

                if (paths.length === 0) return callback()

                utils.deleteFiles(paths, callback)
            },
            callback => {
                user.fetchSpecificUserInfo(req.body.userId, data, callback)
            },
            callback => {
                user.modifyUserInformation(data, callback)
            }
        ],
        err => {
            if (err) {
                return callback(err, req, res)
            }

            return callback(null, req, res, data)
        }
    )
})

router.post("/create-user-profile", function (req, res) {
    let sessionInfo = {}
    let hashedPassword
    let data = {}

    async.series(
        [
            callback => {
                common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer)
            },
            callback => {
                hashedPassword = crypto.createHash("md5").update(req.body.password).digest("hex")
                callback()
            },
            callback => {
                req.body.createdBy = sessionInfo["username"]
                user.createUserProfile(req.body, hashedPassword, data, callback)
            }
        ],
        err => {
            if (err) {
                return callback(err, req, res, data)
            }

            callback(null, req, res, data)
        }
    )
})

router.post("/create-reseller-profile", function (req, res) {
    let sessionInfo = {}
    let hashedPassword
    let userInfo = {}
    let referredUserInfo = {}
    let referralData = {}
    let data = {}
    const authUserId = req.body.userId
    const referredByUserId = req.body.referredByUserId

    async.series(
        [
            callback => {
                common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer)
            },
            callback => {
                hashedPassword = crypto.createHash("md5").update(req.body.password).digest("hex")
                callback()
            },
            callback => {
                req.body.createdBy = sessionInfo["username"]
                user.createResellerProfile(req.body, hashedPassword, data, callback)
            },
            callback => {
                if (!cfg.regReferralEngOnResellerCreation) return callback()

                user.retrieveUserInformationUsingId(req.body.userId, referredUserInfo, callback)
            },
            callback => {
                if (!cfg.regReferralEngOnResellerCreation) return callback()

                user.retrieveUserInformationUsingId(data.userId, userInfo, callback)
            },
            callback => {
                if (!cfg.regReferralEngOnResellerCreation) return callback()

                user.referralUserRegistration(
                    {
                        userId: referredUserInfo.userId,
                        fullName: referredUserInfo.fullName,
                        mobileNo: referredUserInfo.mobileNo,
                        email: referredUserInfo.email
                    },
                    referralData,
                    callback
                )
            },
            callback => {
                if (!cfg.regReferralEngOnResellerCreation) return callback()

                user.referralUserRegistration(
                    {
                        userId: userInfo.userId,
                        fullName: userInfo.fullName,
                        mobileNo: userInfo.mobileNo,
                        email: userInfo.email,
                        parentToken: referralData["token"]
                    },
                    referralData,
                    callback
                )
            },
            callback => {
                if (!cfg.regReferralEngOnResellerCreation) return callback()

                if (referralData["type"] !== "new") return callback()

                user.incrementReferralCount(
                    {
                        userId: referredUserInfo.userId,
                        username: referredUserInfo.username
                    },
                    callback
                )

                user.updateUserReferredBy(
                    {
                        userId: authUserId,
                        referredUserId: referredUserInfo.userId ? referredUserInfo.userId : referredByUserId
                    },
                    callback
                )
            }
        ],
        err => {
            if (err) {
                return callback(err, req, res)
            }

            callback(null, req, res, data)
        }
    )
})

router.post("/user-profile-update", function (req, res) {
    let sessionInfo = {}
    let updatedUserInfo = []

    async.series(
        [
            callback => {
                common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer)
            },
            callback => {
                user.fetchSpecificUserInfo(req.body.updatedUserId, updatedUserInfo, callback)
            },
            callback => {
                if (req.body.updatedFields.password) {
                    let authorized = rolePermission.checkRolePermission(sessionInfo.rolePermissions, {
                        resource: "platform_user_change_password_by_others",
                        actionType: rolePermission.actionType.UPDATE,
                        attributes: []
                    })
                    if (!authorized) {
                        return callback(resGen.responseGenerator(resGen.AUTH_TOKEN_ERR, "You do not have sufficient permission"))
                    }
                }
                if (req.body.updatedFields.roleId) {
                    let authorized = rolePermission.checkRolePermission(sessionInfo.rolePermissions, {
                        resource: "platform_user_change_role_by_others",
                        actionType: rolePermission.actionType.UPDATE,
                        attributes: [
                            {
                                name: "user_id",
                                value: req.body.userId
                            },
                            {
                                name: "from_role_id",
                                value: updatedUserInfo[0].roleId
                            },
                            {
                                name: "to_role_id",
                                value: req.body.updatedFields.roleId
                            }
                        ]
                    })
                    if (!authorized) {
                        return callback(resGen.responseGenerator(resGen.AUTH_TOKEN_ERR, "You do not have sufficient permission"))
                    }
                }
                return callback()
            },
            callback => {
                user.updateUserProfile(req.body.userId, req.body.updatedUserId, req.body.updatedFields, sessionInfo["username"], callback)
            }
        ],
        err => {
            if (err) {
                return callback(err, req, res)
            }

            return callback(null, req, res)
        }
    )
})

router.post("/check-cash-agent-id", function (req, res) {
    let sessionInfo = {}
    let container = {}

    async.series(
        [
            callback => {
                common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer)
            },
            callback => {
                order.retrieveExecutionTaskInformation(cfg.executionConfigIdMapping["PLATFORM_CASH"], container, callback)
            },
            callback => {
                container["cashAgentId"] = req.body.cashAgentId
                user.getCashAgentInfo(container, callback)
            }
        ],
        err => {
            if (err) {
                return callback(err, req, res)
            }

            return callback(null, req, res, {
                agentName: container["agentName"],
                agentEmail: container["agentEmail"]
            })
        }
    )
})

router.post("/set-cash-agent-id", function (req, res) {
    let sessionInfo = {}
    let container = {}

    async.series(
        [
            callback => {
                common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer)
            },
            callback => {
                user.checkIfUserExists(req.body.assignedUserId, callback)
            },
            callback => {
                order.retrieveExecutionTaskInformation(cfg.executionConfigIdMapping["PLATFORM_CASH"], container, callback)
            },
            callback => {
                container["cashAgentId"] = req.body.cashAgentId
                user.getCashAgentInfo(container, callback)
            },
            callback => {
                user.setCashAgentId(
                    {
                        assignedUserId: req.body.assignedUserId,
                        cashAgentId: req.body.cashAgentId,
                        assignedBy: sessionInfo["username"]
                    },
                    callback
                )
            }
        ],
        err => {
            if (err) {
                return callback(err, req, res)
            }

            return callback(null, req, res)
        }
    )
})

router.post("/contact-user-list", function (req, res) {
    let sessionInfo = {}
    let data = []

    async.series(
        [
            callback => {
                common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer)
            },
            callback => {
                user.getUserContactList(data, callback)
            }
        ],
        err => {
            if (err) {
                return callback(err, req, res)
            }

            return callback(null, req, res, data)
        }
    )
})
router.post("/app-token-update", function (req, res) {
    let data = []
    let sessionInfo = {}

    async.series(
        [
            callback => {
                common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer)
            },
            callback => {
                user.updateUserAppTokenFunc(req.body.userId, sessionInfo["username"], req.body.appToken, callback)
            }
        ],
        err => {
            if (err) {
                return callback(err, req, res, data)
            }

            callback(null, req, res, data)
        }
    )
})
router.post("/user/balance-check", function (req, res) {
    let userInfo = {}
    let userBalance = {}
    let walletDetails = []
    let paymentMethodInfo = {}
    let sessionInfo = {}
    let request = {
        userId: req.body.userId,
        sessionId: req.body.sessionId
    }

    async.series(
        [
            callback => {
                common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer)
            },
            callback => {
                user.retrieveUserWalletInformation(request, walletDetails, callback)
            },
            callback => {
                userBalance.walletDetails = walletDetails
                user.retrieveUserBalanceInformationByUserId(request.userId, userBalance, callback)
            },
            callback => {
                wallet.getUserPaymentMethodInfo(request.userId, 1, paymentMethodInfo, callback)
            },
            callback => {
                userBalance.partner_limit = 0
                if (paymentMethodInfo.id) {
                    userBalance.partner_limit = paymentMethodInfo.balance
                }
                return callback()
            }
        ],
        err => {
            if (err) {
                return callback(err, req, res, userBalance)
            }
            callback(null, req, res, userBalance)
        }
    )
})
router.post("/user/get-mobile-number", function (req, res) {
    let data = {}
    let userInfo = {}
    let sessionInfo = {}
    let hashedPassword

    async.series(
        [
            /*callback => {
            common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        },*/
            callback => {
                user.retrieveUserInfoForgetPassword(req.body, userInfo, data, callback)
            },
            callback => {
                if (!userInfo.forgetPasswordEmailAuthentication) {
                    user.formatUserMobileNumber(req.body, userInfo, data, callback)
                } else {
                    user.formatUserEmail(req.body, userInfo, data, callback)
                }
            }
        ],
        err => {
            if (err) {
                return callback(err, req, res, data)
            }

            callback(null, req, res, data)
        }
    )
})
router.post("/user/forget-password", function (req, res) { // currently not used. A new api is called for this purpose..
    let hashedPassword
    let data = {}
    let otpVerifyResult = {}
    let userInfo = {}

    let otpInfo = {
        purpose: "forget-password",
        userId: req.body.mobileNo,
        otp: req.body.otp
    }

    async.series(
        [
            callback => {
                delete req.body.purpose
                delete req.body.mobileNo
                delete req.body.otp
                common.validateOtp(otpInfo, otpVerifyResult, callback)
            },
            callback => {
                common.deleteOtp(otpInfo, callback)
            },
            callback => {
                user.retrieveUserInfoForgetPassword(req.body, userInfo, data, callback)
            },
            callback => {
                hashedPassword = crypto.createHash("md5").update(req.body.password).digest("hex")

                user.updatePassword(userInfo.userId, userInfo.userName, hashedPassword, callback)
                /* if(req.body.password === req.body.confirmPassword){
              } else {
                  return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, "Password didn't match"));

              }*/
            }
        ],
        err => {
            if (err) {
                return callback(err, req, res, data)
            }

            callback(null, req, res, data)
        }
    )
})

router.post("/referral/create-link", function (req, res) {
    let appInfo
    let userInfo = {}
    let referralData = {}
    let data = {}

    async.series(
        [
            callback => {
                const platformInfo = cfg.inviteFriends[req.body.channel]
                if (!platformInfo) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, `No '${req.body.channel}' specific configuration found`))
                }
                for (let app of platformInfo) {
                    if (app.appName === req.body.appName) {
                        appInfo = app
                        return callback()
                    }
                }
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, `No '${req.body.appName}' specific configuration found`))
            },
            callback => {
                common.verifySession(req.body.userId, req.body.sessionId, callback, {}, req.headers.referer)
            },
            callback => {
                user.retrieveUserInformationUsingId(req.body.userId, userInfo, callback)
            },
            callback => {
                user.referralUserRegistration(
                    {
                        userId: userInfo.userId,
                        fullName: userInfo.fullName,
                        mobileNo: userInfo.mobileNo,
                        email: userInfo.email
                    },
                    referralData,
                    callback
                )
            },
            callback => {
                user.createDynamicLink(
                    {
                        platformUserId: req.body.userId,
                        apiKey: appInfo.apiKey,
                        dynamicLinkInfo: appInfo.dynamicLinkInfo
                    },
                    data,
                    callback
                )
            },
            callback => {
                data.referralCount = userInfo.referralCount
                return callback()
            }
        ],
        err => {
            if (err) {
                return callback(err, req, res, data)
            }

            return callback(null, req, res, data)
        }
    )
})

router.post("/referral/add-user", function (req, res) {
    let userInfo = {}
    let referredUserInfo = {}
    let referralData = {}

    req.body.userId = Number(req.body.userId)
    req.body.referredUserId = Number(req.body.referredUserId)
    if (req.body.userId === req.body.referredUserId) return callback(null, req, res)

    const authUserId = req.body.userId
    const referredByUserId = req.body.referredByUserId

    async.series(
        [
            callback => {
                common.verifySession(req.body.userId, req.body.sessionId, callback, {}, req.headers.referer)
            },
            callback => {
                user.retrieveUserInformationUsingId(req.body.userId, userInfo, callback)
            },
            callback => {
                user.retrieveUserInformationUsingId(req.body.referredUserId, referredUserInfo, callback)
            },
            callback => {
                user.referralUserRegistration(
                    {
                        userId: referredUserInfo.userId,
                        fullName: referredUserInfo.fullName,
                        mobileNo: referredUserInfo.mobileNo,
                        email: referredUserInfo.email
                    },
                    referralData,
                    callback
                )
            },
            callback => {
                user.referralUserRegistration(
                    {
                        userId: userInfo.userId,
                        fullName: userInfo.fullName,
                        mobileNo: userInfo.mobileNo,
                        email: userInfo.email,
                        parentToken: referralData["token"]
                    },
                    referralData,
                    callback
                )
            },
            callback => {
                if (referralData["type"] !== "new") return callback()

                user.incrementReferralCount(
                    {
                        userId: req.body.referredUserId,
                        username: referredUserInfo.username
                    },
                    callback
                )
            },
            callback => {
                if (referralData["type"] !== "new") return callback()

                user.updateUserReferredBy(
                    {
                        userId: authUserId,
                        referredUserId: referredUserInfo.userId ? referredUserInfo.userId : referredByUserId
                    },
                    callback
                )
            }
        ],
        err => {
            return callback(null, req, res)
        }
    )
})

router.post("/check-password", function (req, res) {
    let userInfo = {}

    async.series(
        [
            callback => {
                common.verifySession(req.body.userId, req.body.sessionId, callback, {}, req.headers.referer)
            },
            callback => {
                user.retrieveUserInformationUsingId(req.body.userId, userInfo, callback)
            },
            callback => {
                let calculatedHashedPassword = crypto.createHash("md5").update(req.body.password).digest("hex")
                if (calculatedHashedPassword !== userInfo.password) {
                    return callback(resGen.responseGenerator(resGen.AUTH_ERR, "Password does not match", resDet.PASSWORD_NOT_MATCH))
                }

                callback()
            }
        ],
        err => {
            if (err) {
                err = resGen.finalizeResponse(err, {
                    offset: resDet.offset.platform
                })
                return callback(err, req, res)
            }

            callback(null, req, res)
        }
    )
})

router.post("/user/nearby-agents", function (req, res) {
    let data = []

    async.series(
        [
            callback => {
                common.verifySession(req.body.userId, req.body.sessionId, callback, {}, req.headers.referer)
            },
            callback => {
                user.findNearbyAgents(
                    {
                        latitude: req.body.latitude,
                        longitude: req.body.longitude
                    },
                    data,
                    callback
                )
            }
        ],
        err => {
            if (err) {
                err = resGen.finalizeResponse(err, {
                    offset: resDet.offset.platform
                })
                return callback(err, req, res, data)
            }

            callback(null, req, res, data)
        }
    )
})

router.post("/user/support-contacts", function (req, res) {
    let data = []
    console.log("support-contacts req.body", req.body)
    async.series(
        [
            callback => {
                if (req.body.isAuth) common.verifySession(req.body.userId, req.body.sessionId, callback, {}, req.headers.referer)
                else callback()
            },
            callback => {
                user.supportContacts(req.body.appType, data, callback)
            }
        ],
        err => {
            if (err) {
                return callback(err, req, res, data)
            }

            callback(null, req, res, data)
        }
    )
})

router.post("/migrate/user/role", function (req, res) {
    let data = {
        userId: req.body.userId,
        migrateType: "manual"
    }
    async.series(
        [
            callback => {
                common.verifySession(req.body.authUserId, req.body.sessionId, callback, {}, req.headers.referer)
            },
            callback => {
                userMigration.migrateUserRole(data, callback)
            }
        ],
        err => {
            if (err) {
                console.log("err", err)
                return callback(err, req, res, data)
            }
            callback(null, req, res, data)
        }
    )
})

router.post("/sd/refund-request", function (req, res) {
    let requestData
    let userInfo = {}
    async.series(
        [
            callback => {
                common.verifySession(req.body.userId, req.body.sessionId, callback, {}, req.headers.referer)
            },
            callback => {
                user.getUserInfoByUserId(req.body.userId, userInfo, callback)
            },

            callback => {
                requestData = {
                    userId: req.body.userId,
                    requestReason: req.body.requestReason,
                    securityDepositAmount: userInfo.securityDepositAmount
                }
                user.requestSecurityDepositRefund(requestData, callback)
            }
        ],
        err => {
            if (err) {
                console.log("err", err)
                return callback(err, req, res, null)
            }
            callback(null, req, res, "successfully requested")
        }
    )
})

router.post("/sd/process-refund-request", function (req, res) {
    let sessionInfo = {}
    let fundTransferData = {}
    let requestedUserInfo = {}
    async.series(
        [
            callback => {
                common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer)
            },
            callback => {
                user.checkAlreadyApproved(req.body.refundRequestId, callback)
            },
            callback => {
                user.fetchUserInfoUsingReferenceId(req.body.refundRequestId, requestedUserInfo, callback)
            },
            callback => {
                if (req.body.actionType == "approve") {
                    req.body.status = "approved"
                    user.processRefundRequest(req.body, callback)
                } else {
                    req.body.status = "rejected"
                    user.processRefundRequest(req.body, () => {
                        let data = {
                            userNameOrId: requestedUserInfo.userId,
                            title: "Rejected",
                            body: "Sorry, your security deposit refund request has been rejected"
                        }
                        common.sendNotification(data, () => {
                            return callback(resGen.responseGenerator(resGen.SUCCESS, "successfully rejected refund request"))
                        })
                    })
                }
            },
            callback => {
                console.log("hello from point transfer callback")
                fundTransferData = {
                    userName: sessionInfo.username,
                    userId: requestedUserInfo.userId,
                    amount: requestedUserInfo.securityDepositAmount
                }
                console.log("fundTransferData is ", fundTransferData)
                user.proceedFundTransfer(fundTransferData, callback)
            },
            callback => {
                user.updateUserInfo(requestedUserInfo.userId, callback)
            },
            callback => {
                let data = {
                    userNameOrId: requestedUserInfo.userId,
                    title: "Approved",
                    body: "Successfully refunded security deposit amount into your account"
                }
                common.sendNotification(data, callback)
            }
        ],
        err => {
            if (err && !err.errorType && err.errorType != "notification") {
                console.log("err", err)
                return callback(err, req, res, null)
            }
            callback(null, req, res, "successfully processed")
        }
    )
})

router.post("/change-phone-number", function (req, res) {
    let userInfo = {}
    let sessionInfo = {}
    let otpData = {}
    let info = {}

    async.series(
        [
            callback => {
                common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer)
            },
            callback => {
                user.retrievePassword(req.body.userId, userInfo, callback)
            },
            callback => {
                console.log("userInfo is ", userInfo)
                let calculatedHashedPassword = crypto.createHash("md5").update(req.body.password).digest("hex")
                if (calculatedHashedPassword !== userInfo.user_pwd) {
                    return callback(resGen.responseGenerator(resGen.AUTH_ERR, "Password does not match", resDet.PASSWORD_NOT_MATCH))
                }
                callback()
            },
            callback => {
                info = {
                    userId: req.body.userId,
                    purpose: "phone-number-change",
                    clientApp: req.body.clientApp
                }
                common.createOtpForSomePurpose(info, otpData, callback)
            },
            
            callback => {
                req.body.otp = info.token
                common.sendSms(req.body, req.body.countryCode, "otp", req.body.mobileNo, callback)
            }
            
        ],
        err => {
            if (err) {
                console.log("error is ", err)
                callback(err, req, res, null)
            } else {
                callback(null, req, res, "successfully requested and otp sent")
            }
        }
    )
})

router.post("/change-user-email", function (req, res) {
    let sessionInfo = {}
    let otpData = {}
    let info = {}

    async.series(
        [
            callback => {
                common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer)
            },
            callback => {
                info = {
                    userId: req.body.userId,
                    purpose: "email-change",
                    receiver: req.body.email
                }
                common.sendOtpEmail(info, otpData, callback)
            }
        ],
        err => {
            if (err) {
                console.log("error: ", err)
                callback(err, req, res, null)
            } else {
                callback(null, req, res, "otp has been successfully sent")
            }
        }
    )
})

router.post("/sd/refund-user-history", function (req, res) {
    let sessionInfo = {}
    let resultData = {}
    async.series(
        [
            callback => {
                common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer)
            },
            callback => {
                user.refundUserHistory(req.body.userId, resultData, callback)
            }
        ],
        err => {
            if (err) {
                console.log("error is ", err)
                callback(err, req, res, null)
            } else {
                callback(null, req, res, resultData)
            }
        }
    )
})


router.post("/user/forget-password-new", function (req, res) {
    let hashedPassword
    let data = {}
    let otpVerifyResult = {}
    let userInfo = {}

    let otpInfo = {
        purpose: "forget-password",
        userId: req.body.mobileNo,
        otp: req.body.otp
    }

    async.series(
        [
            callback => {
                delete req.body.purpose
                delete req.body.mobileNo
                delete req.body.otp
                common.validateOtpforSpecificPurpose(otpInfo, otpVerifyResult, callback)
            },
            callback => {
                common.deleteOtpforSpecificPurpose(otpInfo, callback)
            },
            callback => {
                user.retrieveUserInfoForgetPassword(req.body, userInfo, data, callback)
            },
            callback => {
                hashedPassword = crypto.createHash("md5").update(req.body.password).digest("hex")
                user.updatePassword(userInfo.userId, userInfo.userName, hashedPassword, callback)
            }
        ],
        err => {
            if (err) {
                return callback(err, req, res, data)
            }

            console.log('my data:', data)

            callback(null, req, res, data)
        }
    )
})
function userResourceUpdatedFields(resources) {
    let resourceUpdatedFields = {
        profile: false,
        passport: false
    }

    for (let index in resources) {
        let resource = resources[index]
        if (resource.name === "profile-pic") {
            resourceUpdatedFields.profile = true
        }

        if (resource.name === "passport-pic") {
            resourceUpdatedFields.passport = true
        }
    }

    return resourceUpdatedFields
}

module.exports = router
