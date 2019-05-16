"use strict"

const async = require("async")
const fs = require("fs")
const mkdirs = require("fs-extra").mkdirs
const uuidv1 = require("uuid/v1")
const moment = require("moment")
const nodeMailer = require("nodemailer")
const otplib = require("otplib")
const crypto = require("crypto")
const url = require("url")

const resGen = require("../../lib/result.codes")
const resDet = require("../../lib/result.details")
const util = require("../../lib/utils")
const perms = require("../../lib/menu.permission")
const queries = require("./queries")
const db = require("../../resources/database.connection")
const cfg = require("../../config")
const th = require("../../lib/tokenhandler")
const emailProperties = require("../../resources/email.properties")
const checklist = require("../../resources/checklist")
const smsProperties = require("../../resources/sms.properties")
const request = require("request")
const activityLogService = require("./activitylog/activityLogService")

function createOtp(info, data, callback) {
    console.log("otp info: ", info)
    otplib.authenticator.options = { digits: 6 }
    if (info.clientApp && info.clientApp == "user_app") {
        otplib.authenticator.options = { digits: 4 }
    }

    const secret = otplib.authenticator.generateSecret()
    let token = otplib.authenticator.generate(secret)

    // const token = info.clientApp && info.clientApp == "user_app" ? 1234 : 123456
    // if (info.clientApp && info.clientApp == "user_app") {
    //     token = 1234
    // }
    info.secret = secret
    info.token = token
    let serializedData = JSON.stringify(info)

    db.redis.set(queries.keyForOTP(info.purpose, info.userId, token), serializedData, "EX", cfg.ttl.otp, function (err, reply) {
        if (err) {
            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
        }

        data.userId = info.userId
        console.log('eee',data.userId)
        callback()
    })
}

function createOtpForSomePurpose(info, data, callback) {

    otplib.authenticator.options = { digits: 6 }
    if (info.clientApp && info.clientApp === "user_app") {
        otplib.authenticator.options = { digits: 4 }
    }

    info.expireTime = cfg.otpSystem.expireTime
    info.activeTime = cfg.otpSystem.activeTime
    info.secret = otplib.authenticator.generateSecret()
    info.token = otplib.authenticator.generate(info.secret)
    info.timestamp = Date.now()

    const serializedData = JSON.stringify(info)

    db.redis.set(queries.UniquekeyForOTP(info.purpose, info.userId), serializedData, "NX", "EX", cfg.ttl.otpnew, function (err, reply) {
        if (err) {
            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
        }

        if (reply === "OK") {
            data.userId = info.userId
            callback()
           
        } else if (reply === null) {
            db.redis.get(queries.UniquekeyForOTP(info.purpose, info.userId), function(e, data){
                if (e) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, e))
                } 
                if (data !== null) {
                    const otpData = JSON.parse(data)
                    const currentTime = Date.now()
                    const timeDifference = currentTime - otpData.timestamp

                    if (timeDifference < otpData.activeTime) {
                        const timeRemaining = otpData.activeTime - timeDifference
                        return callback(resGen.responseGenerator(resGen.TRY_LATER, `Unable to request another OTP right now. Please use the current OTP which is sent to your registered mobile or email number. It's valid for next ${Math.floor(timeRemaining / 1000)} seconds.`))
                    }

                    if (timeDifference < otpData.expireTime) {
                        return callback(resGen.responseGenerator(resGen.TRY_LATER, `Cannot request another OTP at the moment. Current OTP expires in ${Math.floor((otpData.expireTime - timeDifference) / 1000)} seconds. Wait before requesting a new one.`))
                    }
                }
            });
        } 
    });
}

function createOtpforSpecificPurpose(info, data, callback) {

   let infoObj = {
        userId: info.mobileNo || info.userId, 
        purpose: info.purpose,
        clientApp: info.clientApp,
        smsChannel: info.channel,
        countryCode: info.countryCode,
    }

    const expireTime = cfg.otpSystem.expireTime
    const activeTime = cfg.otpSystem.activeTime

    otplib.authenticator.options = { digits: 6 }
    if (infoObj.clientApp && infoObj.clientApp === "user_app") {
        otplib.authenticator.options = { digits: 4 }
    }

    const secret = otplib.authenticator.generateSecret()
    let token = otplib.authenticator.generate(secret)

    let infoObjRedis = {}
    infoObjRedis.secret = secret
    infoObj.otp = infoObjRedis.token = token
    infoObjRedis.activeTime = activeTime
    infoObjRedis.expireTime = expireTime
    infoObjRedis.timestamp = Date.now()
    infoObjRedis.purpose = infoObj.purpose // new added

    const serializedData = JSON.stringify(infoObjRedis)
    console.log('serializedData:', serializedData)

    db.redis.set(queries.UniquekeyForOTP(infoObj.purpose, infoObj.userId), serializedData, "NX", "EX", cfg.ttl.otpnew, function (err, reply) {
        if (err) {
            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
        }

        if (reply === "OK") {
            if (info.type === "Email") {
                data.userId = info.userId
                callback()
            } else {
                if (["digi"].includes(infoObj.smsChannel)) {
                    sendSmsPartner(infoObj, "otp", infoObj.userId, callback)
                 } else {
                    sendSms(infoObj, infoObj.countryCode, "otp", infoObj.userId, callback)
                 }
            }

        } else if (reply === null) {
            db.redis.get(queries.UniquekeyForOTP(infoObj.purpose, infoObj.userId), function(e, data){
                if (e) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, e))
                } 
                if (data !== null) {
                    const otpData = JSON.parse(data)
                    const currentTime = Date.now()
                    const timeDifference = currentTime - otpData.timestamp

                    if (timeDifference < otpData.activeTime) {
                        const timeRemaining = otpData.activeTime - timeDifference
                        return callback(resGen.responseGenerator(resGen.TRY_LATER, `Unable to request another OTP right now. Please use the current OTP which is sent to your registered mobile or email number. It's valid for next ${Math.floor(timeRemaining / 1000)} seconds.`))
                    }

                    if (timeDifference < otpData.expireTime) {
                        return callback(resGen.responseGenerator(resGen.TRY_LATER, `Cannot request another OTP at the moment. Current OTP expires in ${Math.floor((otpData.expireTime - timeDifference) / 1000)} seconds. Wait before requesting a new one.`))
                    }
                }
            });
        } 
    });
}

function sendEmail(emailProperties) {
    let transporter = nodeMailer.createTransport({
        host: cfg.mail.host,
        port: cfg.mail.port,
        secure: false,
        // requireTLS: true,
        auth: {
            user: cfg.mail.username,
            pass: cfg.mail.password
        },
        tls: {
            rejectUnauthorized: false
        }
    })

    let mailOptions = {
        from: cfg.mail.from,
        to: emailProperties.receiver,
        subject: emailProperties.subject,
        html: emailProperties.body
    }

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            cfg.logger.error(error)
        }
    })
}

function sendSms(data, countryCode, messageType, number, callback) {
    let smsDetails = smsProperties.smsChannel["common"]
    let smsBody = smsProperties.generateBody("common", messageType, data)
    if (countryCode === "6" || countryCode === "88") {
        smsBody = smsProperties.generateBody(countryCode, messageType, data)
        smsDetails = smsProperties.smsChannel[countryCode]
    }
    smsDetails.func(countryCode + number, smsBody, smsDetails.options, callback)
}
function sendSmsPartner(data, messageType, number, callback) {
    let smsDetails = smsProperties.smsChannel["digiPayment"]
    let smsBody = encodeURIComponent(smsProperties.smsDetails.otp["digi"].body.replace("$$otp$$", data.otp))
    smsDetails.func(number, smsBody, smsDetails.options, callback)
}

function updateActivityLog(logId, data, err) {
    const updationData = {
        user_id: err ? null : data[0].userId,
        api_response: JSON.stringify(data)
    }
    async.series(
        [
            callback => {
                activityLogService.updateActivityLogEntry(logId, updationData, callback)
            }
        ],
        err => {
            if (err) {
                console.log("Update Activity-log Error: ", err)
            }
        }
    ) /* pop */
}

module.exports = {
    callback: function (err, req, res, data = undefined, showEmpty = false) {
        if (err) {
            req.body.logId && updateActivityLog(req.body.logId, err, 1)
            if (cfg.env === "development" || !checklist.checkEncryption(req.originalUrl)) {
                res.json(
                    resGen.finalizeResponse(err, {
                        offset: resDet.offset.platform
                    })
                )
                return
            }

            // res.status(err.status);
            let container = {}
            if (err.data === undefined) {
                err.data = []
            }

            if (!(err.data instanceof Array)) {
                err.data = [err.data]
            }

            th.encryptPayload(err.data, req.keyInfo.key, container, ierr => {
                if (ierr) {
                    res.json(ierr)
                    return
                }

                err.data = container.payload
                res.json(
                    resGen.finalizeResponse(err, {
                        offset: resDet.offset.platform
                    })
                )
            })
            return
        }

        data = data || []
        if (!(data instanceof Array)) {
            data = [data]
        }

        req.body.logId && updateActivityLog(req.body.logId, data)
        if (cfg.env === "development" || !checklist.checkEncryption(req.originalUrl)) {
            res.json(resGen.responseGenerator(resGen.SUCCESS, "", undefined, 200, data))
            return
        }

        let container = {}
        th.encryptPayload(data, req.keyInfo.key, container, err => {
            if (err) {
                res.json(err)
                return
            }

            res.json(resGen.responseGenerator(resGen.SUCCESS, "", undefined, 200, container.payload))
        })
    },
    createToken: function (userId, tokenInfo, callback) {
        const salt = crypto
            .randomBytes(Math.ceil(cfg.token_length / 2))
            .toString("hex")
            .slice(0, cfg.token_length)
        const token = crypto.createHmac("sha256", salt).digest("hex")
        const serializedData = JSON.stringify({
            "username": tokenInfo.username
        })
        db.redis.set(queries.keyForOTP("reset-password", userId, token), serializedData, "EX", cfg.ttl.resetpassword, function (err, reply) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            tokenInfo.token = token
            tokenInfo.ttl = cfg.ttl.resetpassword
            callback()
        })
    },
    verifyToken: function (userId, token, tokenInfoContainer, callback) {
        db.redis.get(queries.keyForOTP("reset-password", userId, token), function (err, reply) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            if (!reply) {
                return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, "Token does not match", resDet.TOKEN_NOT_MATCH))
            }

            try {
                let ret = JSON.parse(reply)
                Object.keys(ret).forEach(key => (tokenInfoContainer[key] = ret[key]))
            } catch (e) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, e))
            }

            callback()
        })
    },
    deleteToken: function (userId, token, callback) {
        db.redis.del(queries.keyForOTP("reset-password", userId, token), function (err, reply) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            callback()
        })
    },
    validateOtp: function (input, info, callback) {
        console.log("Validate otp step: ", input)
        db.redis.get(queries.keyForOTP(input.purpose, input.userId, input.otp), function (err, reply) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }
            console.log('reply', reply)
            if (!reply) {
                return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, "OTP does not match", resDet.OTP_NOT_MATCH))
            }

            try {
                info.data = JSON.parse(reply)
            } catch (e) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, e))
            }

            callback()
        })
    },
    deleteOtp: function (input, callback) {
        db.redis.del(queries.keyForOTP(input.purpose, input.userId, input.otp), function (err, reply) {
            callback()
        })
    },
    validateOtpforSpecificPurpose: function (input, info, callback) {
        db.redis.get(queries.UniquekeyForOTP(input.purpose, input.userId), function (err, reply) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            if (!reply) {
                return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, "OTP does not match", resDet.OTP_NOT_MATCH))
            }

            try {
                info.data = JSON.parse(reply)
                const otpData = info.data
                const currentTime = Date.now()
                const timeDifference = currentTime - otpData.timestamp

                if (otpData.token !== input.otp) {
                    return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, "OTP does not match", resDet.OTP_NOT_MATCH))
                }
     
                else if (timeDifference < otpData.expireTime) {
                    if(timeDifference > otpData.activeTime) {
                        return callback(resGen.responseGenerator(resGen.TRY_LATER, `Activation time of the OTP is over. Current OTP will expire after ${Math.floor((otpData.expireTime - timeDifference) / 1000)} seconds.`))
                    }
                }
                
            } catch (e) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, e))
            }

            callback()
        })
    },
    deleteOtpforSpecificPurpose: function (input, callback) {
        db.redis.del(queries.UniquekeyForOTP(input.purpose, input.userId), function (err, reply) {
            callback()
        })
    },
    createSession: function (userInfo, data, callback) {
        const sessionId = uuidv1()
        const serializedData = JSON.stringify({
            username: userInfo.username,
            paths: perms.parseMenuPermission(userInfo.menuPermission),
            roleSettings: userInfo.roleSettings,
            rolePermissions: userInfo.rolePermissions
        })

        db.redis.set(queries.keyForSessionId(userInfo.userId, sessionId), serializedData, "EX", cfg.ttl.sessionid, function (err, reply) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }
            data.sessionId = sessionId
            callback()
        })
    },
    verifySession: function (userId, sessionId, callback, sessionInfo, referer, resetSession) {
        if (cfg.checkForReferer && !referer) {
            return callback(resGen.responseGenerator(resGen.AUTH_TOKEN_ERR))
        }

        resetSession = resetSession === undefined ? cfg.ttl.resetsession : resetSession
        if (cfg.checkForReferer && referer) {
            try {
                referer = new url.URL(referer).pathname
            } catch (e) {
                referer = undefined
            }
        }

        db.redis.get(queries.keyForSessionId(userId, sessionId), function (err, reply) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            // console.log("Verify session info: ", JSON.parse(reply));

            if (!reply) {
                console.log("Verify session no-reply: ", JSON.parse(reply))
                return callback(resGen.responseGenerator(resGen.SESSION_EXPIRED_ERR, "Session Expired", resDet.SESSION_EXPIRED))
            }

            if (sessionInfo) {
                try {
                    let info = JSON.parse(reply)
                    if (cfg.checkForReferer && !info.paths.some(path => path === referer)) {
                        return callback(resGen.responseGenerator(resGen.AUTH_TOKEN_ERR))
                    }
                    Object.keys(info).forEach(key => (sessionInfo[key] = info[key]))
                } catch (e) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, e))
                }
            }

            if (!resetSession) return callback()

            db.redis.expire(queries.keyForSessionId(userId, sessionId), cfg.ttl.sessionid, function (err, reply) {
                if (err) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                }

                callback()
            })
        })
    },
    deleteSession: function (userId, sessionId, callback) {
        db.redis.del(queries.keyForSessionId(userId, sessionId), function (err, reply) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            callback()
        })
    },
    getTTLForKey: function (key, data, callback) {
        db.redis.ttl(key, function (err, reply) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            data.ttl = reply
            callback()
        })
    },
    getContentsInformation: function (resources, contents, callback) {
        if (!resources) return callback()

        async.eachOfSeries(
            resources,
            function (item, key, callback) {
                db.redis.get(queries.keyForContentInfo(item.contentId), function (err, reply) {
                    if (err) {
                        return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                    }

                    if (!reply) {
                        return callback(resGen.responseGenerator(resGen.NOT_FOUND, "Content is not found for content id [" + item.contentId + "]"))
                    }

                    try {
                        let fileInfo = JSON.parse(reply)
                        fileInfo.contentId = item.contentId
                        fileInfo.purpose = item.name
                        contents.push(fileInfo)
                    } catch (e) {
                        return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, e))
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
    moveContents: function (userId, contents, callback) {
        if (!contents) return callback()

        let pathGenerator = function (purpose, fileExtension) {
            switch (purpose) {
                case "profile-pic":
                    return "images/profile/" + userId + "-0-" + uuidv1() + fileExtension
                case "passport-pic":
                    return "images/passport/" + userId + "-1-" + uuidv1() + fileExtension
                case "deposit-slip-pic":
                    let now = new Date()
                    return "images/deposit/" + now.getFullYear() + "/" + now.getMonth() + "/" + userId + "/" + uuidv1() + fileExtension
                case "product-pic":
                    return "images/product/" + uuidv1() + fileExtension
                case "banner-pic":
                    return "images/banner/" + uuidv1() + fileExtension
            }
        }
        async.eachOfSeries(
            contents,
            function (item, key, callback) {
                item.dstPath = pathGenerator(item.purpose, item.extension)
                let split = item.dstPath.split("/")
                let dstDirectory = cfg.fileRootDirectory + split.slice(0, split.length - 1).join("/")
                fs.stat(dstDirectory, function (err, stats) {
                    if (!err) {
                        return util.remove(item.path, cfg.fileRootDirectory + item.dstPath, err => {
                            if (err) {
                                return callback(resGen.responseGenerator(resGen.NOT_FOUND, "Content is not found for content id [" + item.contentId + "]"))
                            }

                            return callback()
                        })
                    }

                    mkdirs(dstDirectory, function (err) {
                        if (err) {
                            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                        }

                        util.remove(item.path, cfg.fileRootDirectory + item.dstPath, err => {
                            if (err) {
                                return callback(resGen.responseGenerator(resGen.NOT_FOUND, "Content is not found for content id [" + item.contentId + "]"))
                            }

                            return callback()
                        })
                    })
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
    setResourcesFields: function (updatedFields, contents, callback) {
        for (let index in contents) {
            switch (contents[index].purpose) {
                case "profile-pic":
                    updatedFields.profilePic = contents[index].dstPath
                    break
                case "passport-pic":
                    updatedFields.passportPic = contents[index].dstPath
                    break
                case "deposit-slip-pic":
                    updatedFields.depositSlipPic = contents[index].dstPath
                    break
                case "product-pic":
                    updatedFields.productPic = contents[index].dstPath
                    break
                case "banner-pic":
                    updatedFields.bannerPic = contents[index].dstPath
                    break
            }
        }

        return callback()
    },
    getCurrencyInfo: function (query, currencyInfo, callback) {
        let columns = ["currency_country_id", "currency_status", "currency_base"]
        let values = [query.id, 1, query.isBaseCurrency ? 1 : 0]
        let condition = util.generateDynamicWhereCondition(columns, values)
        db.mysql.query(queries.baseCurrency(condition.whereCondition), condition.replacements, function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            if (results.length === 0) {
                return callback(resGen.responseGenerator(resGen.NOT_FOUND, "No currency info found", resDet.INVALID_CURRENCY_ID))
            }

            Object.assign(currencyInfo, results[0])
            return callback()
        })
    },
    verifyPassword: function (givenPassword, hashedPassword, passwordExpiry, callback) {
        if (!givenPassword) {
            return callback(resGen.responseGenerator(resGen.REQUIRED_PARAMS_ERR, "Password is required", resDet.PASSWORD_REQUIRED))
        }

        let calculatedHashedPassword = crypto.createHash("md5").update(givenPassword).digest("hex")
        if (calculatedHashedPassword !== hashedPassword) {
            return callback(resGen.responseGenerator(resGen.AUTH_ERR, "Password does not match", resDet.PASSWORD_NOT_MATCH))
        }

        if (moment(passwordExpiry).toDate().getTime() < new Date().getTime()) {
            return callback(resGen.responseGenerator(resGen.AUTH_ERR, "Password expired", resDet.PASSWORD_EXPIRED))
        }

        callback()
    },
    sendEmail: sendEmail,
    sendOtpEmail: function (info, data, callback) {
        async.series(
            [
                callback => {
                    createOtpForSomePurpose(info, data, callback)
                },
                callback => {
                    let subject = info.subject || "Token validation"
                    let message = "Here is your OTP: " + info.token
                    let emailBody = emailProperties.generateOtpEmailBody(message)

                    if (!(info.receiver instanceof Array)) {
                        info.receiver = [info.receiver]
                    }
                    info.receiver.forEach(receiver =>
                        sendEmail({
                            receiver: receiver,
                            subject: subject,
                            body: emailBody
                        })
                    )
                    callback()
                }
            ],
            err => {
                if (err) {
                    return callback(err)
                }

                callback(null)
            }
        )
    },
    deleteRedisKey: function (pattern, callback) {
        let script = "for i, name in ipairs(redis.call('KEYS', ARGV[1])) do redis.call('DEL', name); end"

        db.redis.eval(script, 0, pattern, function (err, reply) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }
            callback()
        })
    },
    createOtp: createOtp,
    createOtpforSpecificPurpose: createOtpforSpecificPurpose,
    createOtpForSomePurpose: createOtpForSomePurpose,
    sendSmsPartner: sendSmsPartner,
    sendSms: sendSms,
    sendOtpSms: function (info, data, callback) {
        let countryCode = info.countryCode
        let mobileNo = info.mobileNo
        async.series(
            [
                callback => {
                    createOtpForSomePurpose(info, data, callback)
                },
                callback => {
                    info.otp = info.token
                    sendSms(info, countryCode, "otp", mobileNo, callback)
                }
           
            ],
            err => {
                if (err) {
                    return callback(err)
                }

                callback(null)
            }
        )
    },
    getUserAppToken: function (arug, userData, callback) {
        let arugData = [arug.userNameOrId, arug.userNameOrId] //, arug.userNameOrId];
        //  console.log("getUserAppToken arugData: ", arugData);
        //  console.log("queries.getUserToken", queries.getUserToken);
        db.mysql.query(queries.getUserToken, arugData, function (err, results) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            if (results.length === 0) {
                return callback(resGen.responseGenerator(resGen.NOT_FOUND, undefined, resDet.NO_USER_FOUND))
            }
            if (results.length > 0) {
                let userToken = []
                results.filter(item => {
                    // console.log("item.user_app_token", item.user_app_token);
                    userToken.push(item.user_app_token.toString())
                })
                Object.assign(userData, userToken)
            }
            callback()
        })
    },
    sendNotification: function (argu, callback) {
        let url = cfg.notification.baseUrl
        let userToken = []

        async.series(
            [
                callback => {
                    let data = {
                        userNameOrId: argu.userNameOrId
                    }
                    this.getUserAppToken(data, userToken, callback)
                },
                callback => {
                    if (userToken.length == 0) {
                        const error = resGen.responseGenerator(resGen.NOT_FOUND, resDet.NO_USER_FOUND)
                        return callback(error)
                    }
                    let requestData = {
                        "from": "platform",
                        "to": [
                            {
                                "token": userToken
                            }
                        ],
                        "data": {
                            "title": argu.title,
                            "body": argu.body
                        },
                        "type": "NOTIFICATION",
                        "serviceID": "platform",
                        "refID": Date.now().toString()
                    }
                    request(
                        {
                            url: url,
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json"
                            },
                            json: true,
                            body: requestData
                        },
                        function (err, response, body) {
                            if (!err && body.status != "Success") {
                                const errorMessage = body.remark
                                return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, errorMessage))
                            }
                            return callback(err)
                        }
                    )
                }
            ],
            err => {
                if (err) {
                    console.log("notification error is ", err)
                    err.errorType = "notification"
                    return callback(err)
                }
                console.log("notification sent")
                callback(null)
            }
        )
    }
}
