"use strict"

const async = require("async")
const net = require("net")
const request = require("request")
const Joi = require("joi")
const moment = require("moment")
const uuidv1 = require("uuid/v1")
const xml = require("fast-xml-parser")

const currency = require("../currency")
const fundTransfer = require("../fund_transfer")
const user = require("../user")
const card = require("../card")

const db = require("../../resources/database.connection")
const resGen = require("../../lib/result.codes")
const resDet = require("../../lib/result.details")
const utils = require("../../lib/utils")
const phoneIdentifier = require("../../lib/phonenumber")
const genericPhoneIdentifier = require("../../lib/genericphonenumber")
const queries = require("./queries")
const engineProperties = require("../../resources/executionengine.properties")
const exeEngConnPool = require("../../resources/exe.eng.connection").pool
const cfg = require("../../config")
const wallet = require("../../components/wallet")
const walletQueries = require("../../components/wallet/queries")

function isFunction(functionToCheck) {
    return functionToCheck && functionToCheck instanceof Function
}

const generateRefId = () => {
    const now = new Date()
    const parts = [
        "s_",
        now.getFullYear().toString(),
        now.getMonth().toString().padStart(2, "0"),
        now.getDate().toString().padStart(2, "0"),
        now.getHours().toString().padStart(2, "0"),
        now.getMinutes().toString().padStart(2, "0"),
        now.getSeconds().toString().padStart(2, "0"),
        Math.round(now.getMilliseconds() / 10)
            .toString()
            .padStart(2, "0")
    ]
    return parts.join("")
}

const BILL_PAYMENT_PRODUCT_FIELDS_MAP = {
    "bd_breb": {
        "infoRequest": {
            "accountNumber": "E_AccountNumber"
        },
        "infoResponse": {
            "Your BILL_NO": "billNo",
            "SMS_AC_NO": "smsACNo",
            "BILL_MONTH": "billMonth",
            "BILL_YEAR": "billYear",
            "ISSUE_DATE": "issueDate",
            "DUE_DATE": "dueDate",
            "PAID_STATUS": "paidStatus",
            "TOTAL_AMOUNT": "amount"
        },
        "paymentRequest": {
            "billType": "E_billType",
            "accountNumber": "E_AccountNumber",
            "billMonth": "E_Bill_Month",
            "billYear": "E_Bill_Year",
            "mobileNo": "E_PayermobileNo",
            "refId": ["E_RefID", generateRefId]
        }
    },
    "bd_wasa": {
        "infoRequest": {
            "billNo": "E_BillNo"
        },
        "infoResponse": {
            "Your BILL_NO": "billNo",
            "SMS_AC_NO": "smsACNo",
            "BILL_MONTH": "billMonth",
            "BILL_YEAR": "billYear",
            "ISSUE_DATE": "issueDate",
            "DUE_DATE": "dueDate",
            "PAID_STATUS": "paidStatus"
        },
        "paymentRequest": {
            "billType": "E_billType",
            "billNo": "E_BillNo",
            "mobileNo": "E_PayerMobileNo",
            "refId": ["E_RefID", generateRefId]
        }
    },
    "bd_desco": {
        "infoRequest": {
            "billNo": "E_BillNo"
        },
        "infoResponse": {
            "Total Bill Amount": "amount"
        },
        "paymentRequest": {
            "billType": "E_billType",
            "billNo": "E_BillNo",
            "mobileNo": "E_PayerMobileNo",
            "refId": ["E_RefID", generateRefId]
        }
    },
    "bd_dpdc": {
        "infoRequest": {
            "accountNumber": "E_AccountNumber",
            "location": "E_Location",
            "billYear": "E_Year",
            "billMonth": "E_Month"
        },
        "infoResponse": {
            "Total Bill Amount": "amount"
        },
        "paymentRequest": {
            "accountNumber": "E_AccountNumber",
            "location": "E_Location",
            "billYear": "E_Year",
            "billMonth": "E_Month",
            "billType": "E_billType",
            "mobileNo": "E_PayerMobileNo",
            "refId": ["E_RefID", generateRefId]
        }
    }
}

const BILL_PAYMENT = {
    "16": {
        "info": function (paymentInfoRequest, paymentInfoResponse, callback) {
            let headers = {
                "Content-Type": "application/json"
            }

            async.series(
                [
                    callback => {
                        retrieveExecutionTaskInformation(paymentInfoRequest.executionConfigId, headers, callback)
                    },
                    callback => {
                        let body = Object.assign({}, paymentInfoRequest)
                        delete body.purpose
                        delete body.executionConfigId

                        request(
                            {
                                url: cfg.billpayment.domain + "/get/utility/payment/info",
                                method: "POST",
                                headers: headers,
                                body: body,
                                json: true
                            },
                            (err, response, body) => {
                                if (err) {
                                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                                }

                                try {
                                    if (body.status_code !== 200) {
                                        return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, body.message))
                                    }

                                    Object.assign(paymentInfoResponse, body.data[0])

                                    return callback()
                                } catch (e) {
                                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, e))
                                }
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
        "infoMerge": function ({ productRefId, paymentInfo, productInfo }, container, callback) {
            container["productMinimumValue"] = paymentInfo.min_amount ? paymentInfo.min_amount : productInfo.productValue
            container["productMaximumValue"] = paymentInfo.amount ? paymentInfo.amount : productInfo.productValue
            return callback()
        },
        "paymentMerge": function ({ productRefId, request, paymentInfo, productInfo }, container, callback) {
            if (request.amount && (request.amount < paymentInfo.min_amount || request.amount > paymentInfo.amount)) {
                return callback(
                    resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, `The amount should be in the range ${paymentInfo.min_amount} & ${paymentInfo.amount}`)
                )
            }

            Object.keys(paymentInfo).forEach(key => {
                if (key.startsWith("param")) {
                    container[key] = paymentInfo[key]
                }
            })

            return callback()
        }
    },
    "22": {
        "infoMap": function (productRefId, request, callback) {
            if (!BILL_PAYMENT_PRODUCT_FIELDS_MAP[productRefId] || !BILL_PAYMENT_PRODUCT_FIELDS_MAP[productRefId].infoRequest) return callback()

            const params = BILL_PAYMENT_PRODUCT_FIELDS_MAP[productRefId].infoRequest
            for (const field of Object.keys(params)) {
                if (!request[field]) {
                    return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, `${field} is required`))
                }

                request[params[field]] = request[field]
                delete request[field]
            }

            return callback()
        },
        "preProcess": function (keyValuePairs, options, callback) {
            if (options.purpose === "info") {
                keyValuePairs["api_ref"] = keyValuePairs["api_ref_info"]
            }
            delete keyValuePairs["api_ref_info"]

            const pairs = []
            Object.keys(keyValuePairs).forEach(key => {
                if (key !== "api_ref") {
                    pairs.push({
                        key: key,
                        value: keyValuePairs[key]
                    })
                }
            })

            async.concat(
                pairs,
                (item, callback) => {
                    request(
                        {
                            url: cfg.billpayment.domain2 + "/call/api",
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json"
                            },
                            body: {
                                api_ref: "encrypt",
                                product_ref: "encrypt",
                                textToEncrypt: item.value
                            },
                            json: true
                        },
                        (err, response, body) => {
                            if (err) {
                                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                            }

                            try {
                                if (body.status_code !== 200) {
                                    return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, body.message))
                                }

                                item.processedValue = body.data
                                return callback(null, item)
                            } catch (e) {
                                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, e))
                            }
                        }
                    )
                },
                (err, results) => {
                    if (err) {
                        return callback(err)
                    }

                    results.forEach(result => {
                        keyValuePairs[result.key] = result.processedValue
                    })

                    return callback()
                }
            )
        },
        "info": function (paymentInfoRequest, paymentInfoResponse, callback) {
            if (paymentInfoRequest.purpose !== "info") return callback()

            let body = Object.assign({}, paymentInfoRequest)
            body.product_ref = paymentInfoRequest.package_code

            delete body.purpose
            delete body.account_id
            delete body.package_code
            delete body.executionConfigId

            request(
                {
                    url: cfg.billpayment.domain2 + "/call/api",
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: body,
                    json: true
                },
                (err, response, body) => {
                    if (err) {
                        return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                    }

                    try {
                        if (body.status_code !== 200) {
                            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR))
                        }

                        const serializedPairs = body.data.split(";")
                        serializedPairs.forEach(serializedPair => {
                            const pairs = serializedPair.split(":")
                            if (pairs.length < 2) return

                            paymentInfoResponse[pairs[0].trim()] = pairs[1].trim()
                        })

                        if (Object.keys(paymentInfoResponse).length === 0) {
                            return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, "Invalid Bill-Payment Info"))
                        }

                        return callback()
                    } catch (e) {
                        return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, e))
                    }
                }
            )
        },
        "infoMerge": function ({ productRefId, paymentInfo, productInfo }, container, callback) {
            if (!BILL_PAYMENT_PRODUCT_FIELDS_MAP[productRefId] || !BILL_PAYMENT_PRODUCT_FIELDS_MAP[productRefId].infoResponse) {
                Object.assign(container, paymentInfo)
                return callback()
            }

            const params = BILL_PAYMENT_PRODUCT_FIELDS_MAP[productRefId].infoResponse
            for (const field of Object.keys(params)) {
                if (paymentInfo[field]) {
                    container[params[field]] = paymentInfo[field]
                } else if (productInfo[field]) {
                    container[params[field]] = productInfo[field]
                }
            }

            if (Object.keys(container).length === 0) {
                return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, "Invalid Bill-Payment Info"))
            }

            return callback()
        },
        "paymentMap": function (productRefId, request, callback) {
            if (!BILL_PAYMENT_PRODUCT_FIELDS_MAP[productRefId] || !BILL_PAYMENT_PRODUCT_FIELDS_MAP[productRefId].paymentRequest) return callback()

            const params = BILL_PAYMENT_PRODUCT_FIELDS_MAP[productRefId].paymentRequest
            for (const field of Object.keys(params)) {
                if (!request[field] && (!Array.isArray(params[field]) || params[field].length < 2 || !isFunction(params[field][1]))) {
                    return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, `${field} is required`))
                }

                let fieldName = params[field]
                let value = request[field]
                if (Array.isArray(params[field]) && params[field].length >= 2 && isFunction(params[field][1])) {
                    fieldName = params[field][0]
                    value = params[field][1]()
                }
                request[fieldName] = value
                delete request[field]
            }

            return callback()
        },
        "exeReqFieldMap": function (executionRequest, request, callback) {
            executionRequest.mobileNo = request.additionalData["mobileNo"] || "NA"
            return callback()
        }
    }
}

function getExecutionHistoryPartition(orderDate) {
    let partitionDate = moment(orderDate).add(1, "M")
    return "p_" + partitionDate.format("YYYY") + partitionDate.format("MM")
}

function getEngineTaskInformation(taskId, taskInfoContainer, callback) {
    db.redis.get(queries.keyForEngineTask(taskId), function (err, reply) {
        if (err) {
            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
        }

        if (reply) {
            try {
                taskInfoContainer.taskInfo = JSON.parse(reply)
            } catch (e) { }
        }

        callback()
    })
}

function fetchEngineTaskInformation(task, taskInfoContainer, callback) {
    request(
        {
            url: task.url,
            method: task.method,
            headers: task.headers,
            body: task.body
        },
        function (err, response, body) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            let taskInfo = task.parser(body)
            if (!taskInfo) return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR))

            taskInfoContainer.taskInfo = taskInfo.data
            taskInfoContainer.ttl = taskInfo.ttl
            callback()
        }
    )
}

function setEngineTaskInformation(taskId, taskInfoContainer, callback) {
    let serializedEngineTaskInfo = JSON.stringify(taskInfoContainer.taskInfo)
    db.redis.set(queries.keyForEngineTask(taskId), serializedEngineTaskInfo, "EX", taskInfoContainer.ttl, function (err, reply) {
        if (err) {
            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
        }

        callback()
    })
}

function retrieveExecutionTaskInformation(executionConfigId, taskInfo, callback) {
    let taskProperties = engineProperties(executionConfigId)
    if (!taskProperties) return callback()

    let taskInfoContainer = {}
    let fetchTaskInformation = false
    async.series(
        [
            callback => {
                getEngineTaskInformation(taskProperties.id, taskInfoContainer, callback)
            },
            callback => {
                fetchTaskInformation = taskInfoContainer.taskInfo === undefined
                if (!fetchTaskInformation) return callback()

                fetchEngineTaskInformation(taskProperties.task, taskInfoContainer, callback)
            },
            callback => {
                Object.keys(taskInfoContainer.taskInfo).forEach(key => (taskInfo[key] = taskInfoContainer.taskInfo[key]))
                if (!fetchTaskInformation) return callback()

                setEngineTaskInformation(taskProperties.id, taskInfoContainer, callback)
            }
        ],
        err => {
            if (err) {
                return callback(err)
            }

            callback()
        }
    )
}

function checkForDuplicateOrderRequest(info, callback) {
    const multi = db.redis.multi()
    multi.get(queries.keyForDuplicateOrderRequest(info.mobileNo))
    multi.ttl(queries.keyForDuplicateOrderRequest(info.mobileNo))

    multi.exec(function (err, reply) {
        if (err || reply.length < 2) {
            return callback()
        }

        let ttl = reply[1]

        info.isDuplicate = !(ttl === -2)
        info.interval = ttl
        info.counter = Number(reply[0]) + 1
        info.skipDelete = false

        const restrictedTime = cfg.operatorBasedTimeLimit[info.operator] || cfg.ttl.duporder

        if (!info.isDuplicate) {
            info.interval = restrictedTime
        }

        if (info.isDuplicate && !cfg.ttl.allowDupOrder) {
            info.skipDelete = true
            return callback(
                resGen.responseGenerator(
                    resGen.INVALID_PARAMS_ERR,
                    `A request for this number ${info.mobileNo} happens a moment ago. Please try again after ${(ttl / 60).toFixed(2)} minutes.`
                )
            )
        }

        return callback()
    })
}

function setForDuplicateOrderRequest(info, callback) {
    const restrictedTime = cfg.operatorBasedTimeLimit[info.operator] || cfg.ttl.duporder
    if (!info.counter || !info.interval) return callback()

    db.redis.set(
        queries.keyForDuplicateOrderRequest(info.mobileNo),
        info.counter,
        "EX",
        info.counter === 1 ? restrictedTime : info.interval + cfg.ttl.duporder,
        function (err, reply) {
            callback()
        }
    )
}

function removeForDuplicateOrderRequest(info, callback) {
    if (info.skipDelete) return callback()

    db.redis.del(queries.keyForDuplicateOrderRequest(info.mobileNo), function (err, reply) {
        callback()
    })
}

function requestReplayToExecutionEngine(request, data, callback) {
    const start = new Date().toISOString()
    exeEngConnPool
        .acquire()
        .then(function (client) {
            /* cfg.logger.info(
                `Execution engine connection establishment - Start: ${start}, End: ${new Date().toISOString()}, Available connections: ${exeEngConnPool.available
                }`
            ) */
            try {
                client.write(JSON.stringify(request))
            } catch (err) {
                exeEngConnPool.destroy(client)
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            client.once("data", payload => {
                try {
                    exeEngConnPool.release(client)
                    let parsedPayload = JSON.parse(payload.toString())
                    const validationResult = Joi.validate(
                        parsedPayload,
                        Joi.object().keys({
                            code: Joi.string().required(),
                            title: Joi.string().required(),
                            details: Joi.string().allow(""),
                            timestamp: Joi.number().integer().required(),
                            data: Joi.array().optional()
                        })
                    )
                    if (validationResult.error !== null) {
                        return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR))
                    }

                    Object.keys(parsedPayload).forEach(key => (data[key] = parsedPayload[key]))
                    return callback()
                } catch (err) {
                    cfg.logger.error(`Execution_Catch_Error|`, err);
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                }
            })
        })
        .catch(function (err) {
            cfg.logger.error(`Execution_Final_Catch_Error|`, err);
            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
        })
}

function popBatchRequest(batchId, container, callback) {
    db.redis.lpop(queries.keyForBulkOrderRequests(batchId), function (err, reply) {
        if (err) {
            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
        }

        if (!reply) {
            return callback(resGen.responseGenerator(resGen.NOT_FOUND))
        }

        try {
            container.request = JSON.parse(reply)
        } catch (e) {
            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, e))
        }

        return callback()
    })
}

function pushBackBatchRequest(batchId, request, callback) {
    let multi = db.redis.multi()

    multi.rpush(queries.keyForBulkOrderRequests(batchId), JSON.stringify(request))
    multi.del(queries.keyForDuplicateOrderRequest(request.mobileNo))

    multi.exec(function (err, replies) {
        if (err) {
            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
        }

        return callback()
    })
}

function sendEachBatchRequest(batchId, callback) {
    let container = {}

    async.series(
        [
            callback => {
                popBatchRequest(batchId, container, callback)
            },
            callback => {
                checkForDuplicateOrderRequest(container.request, callback)
            },
            callback => {
                setForDuplicateOrderRequest(container.request, callback)
            }
        ],
        err => {
            callback(err, container.request)
        }
    )
}

function batchRequestReplayToExecutionEngine(batchId, batchSize, templateReq, callback) {
    let currentBatchRequest
    let processed = 0
    let sendEachBatchRequestCallback = (err, request) => {
        if (err) {
            client.end()
            return err.code === resGen.NOT_FOUND.code ? callback() : callback(err)
        }

        currentBatchRequest = request
        templateReq.productId = request.productId
        templateReq.currencyId = request.currencyId
        templateReq.amount = request.amount
        templateReq.mobileNo = request.mobileNo
        templateReq.operator = request.operator
        templateReq.interval = request.isDuplicate ? request.interval : 0
        templateReq.additionalData.connectionType = request.connectionType
        templateReq.additionalData.operatorCode = request.operatorCode

        client.write(JSON.stringify(templateReq))
    }

    const client = net.createConnection({ host: cfg.engine.host, port: cfg.engine.port }, () => {
        sendEachBatchRequest(batchId, sendEachBatchRequestCallback)
    })

    client.on("error", err => {
        return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
    })

    client.on("data", payload => {
        try {
            processed = processed + 1
            let parsedPayload = JSON.parse(payload.toString())

            if (parsedPayload.code && parsedPayload.code === "500") {
                return pushBackBatchRequest(batchId, currentBatchRequest, err => {
                    if (err) {
                        cfg.logger.error(err)
                    }

                    if (processed === batchSize) {
                        return callback(resGen.responseGenerator(resGen.SUCCESS))
                    }

                    sendEachBatchRequest(batchId, sendEachBatchRequestCallback)
                })
            }

            if (processed === batchSize) {
                return callback(resGen.responseGenerator(resGen.SUCCESS))
            }

            sendEachBatchRequest(batchId, sendEachBatchRequestCallback)
        } catch (e) {
            console.log(e)
        }
    })
}

function requestToExecutionEngine(request, data, callback) {
    const stats = {
        fetch: {},
        execution: {}
    }
    async.series(
        [
            callback => {
                stats.fetch.start = new Date().toISOString()
                retrieveExecutionTaskInformation(request.executionConfigId, request.additionalData, callback)
            },
            callback => {
                stats.fetch.end = new Date().toISOString()
                stats.execution.start = new Date().toISOString()
                requestReplayToExecutionEngine(request, data, callback)
            }
        ],
        err => {
            if (stats.execution.start) {
                stats.execution.end = new Date().toISOString()
            }
            if (cfg.enableExecutionLog) {
                cfg.logger.info(
                    `Fetch: start: ${stats.fetch.start}, end: ${stats.fetch.end}; Execution: start: ${stats.execution.start}, end: ${stats.execution.end
                    }, request: ${JSON.stringify(request)}, response: ${JSON.stringify(data)}`
                )
            }
            if (err) {
                return callback(err)
            }

            return callback()
        }
    )
}

function verifyMobileNumber(mobileNumber, mobileNumberInfo, callback, options) {
    let info = phoneIdentifier(mobileNumber, options)
    if (!info) {
        return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, "Mobile number is invalid", resDet.INVALID_MOBILE_NO))
    }

    Object.keys(info).forEach(key => (mobileNumberInfo[key] = info[key]))
    return callback()
}

function verifyMobileNumberForBulkOrder(mobileNumber, mobileNumberInfo, callback, options) {
    let info = genericPhoneIdentifier(mobileNumber, options)
    if (!info) {
        return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, "Mobile number is invalid", resDet.INVALID_MOBILE_NO))
    }

    Object.keys(info).forEach(key => (mobileNumberInfo[key] = info[key]))
    return callback()
}

const softPinGenerator = {
    "charlie": function ({ transactionRefId }, softPinInfo, callback) {

        /* let queryXML =
            '<?xml version="1.0" encoding="utf-8"?>' +
            '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://www.w3.org/2003/05/soap-envelope">' +
            "<soap:Body>" +
            '<GetReloadPINImmediate xmlns="http://tempuri.org/">' +
            "<sClientUserName>" +
            cfg.charlie.username +
            "</sClientUserName>" +
            "<sClientPassword>" +
            cfg.charlie.password +
            "</sClientPassword>" +
            "<sLocalMOID>" +
            transactionRefId +
            "</sLocalMOID>" +
            "</GetReloadPINImmediate>" +
            "</soap:Body>" +
            "</soap:Envelope>";

        const srsCredentials = {
            sClientUserName: cfg.charlie.username,
            sClientPassword: cfg.charlie.password,
            sLocalMOID: transactionRefId
        }; */
        
        let queryXML = `<?xml version="1.0" encoding="utf-8"?>
        <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
            <soapenv:Header/>
            <soapenv:Body>
                <tem:GetReloadPINImmediate>
                <tem:sClientUserName>${cfg.charlie.username}</tem:sClientUserName>
                <tem:sClientPassword>${cfg.charlie.password}</tem:sClientPassword>
                <tem:sLocalMOID>${transactionRefId}</tem:sLocalMOID>
                </tem:GetReloadPINImmediate>
            </soapenv:Body>
        </soapenv:Envelope>`;

        let headers = {
            'Content-Type': 'text/xml',
            'Accept': 'text/xml'
        };

        request(
            {
                url: cfg.charlie.url,
                method: "POST",
                headers: headers,
                body: queryXML
            },
            (err, response, body) => {
                cfg.logger.info(
                  "CHARLIE-API-Request: " + queryXML + "; ResponseCode: " + response + "; Response: " + body
                );
                
                if (err || response.statusCode !== 200) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                }

                try {
                    const resp = xml.parse(body, { parseNodeValue: false })
                    if (resp["soap:Envelope"]["soap:Body"]["GetReloadPINImmediateResponse"]) {
                        Object.assign(softPinInfo, resp["soap:Envelope"]["soap:Body"]["GetReloadPINImmediateResponse"])
                        return callback()
                    }

                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR))
                } catch (e) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, e))
                }
            }
        )
    },
    "platform": function (request, softPinInfo, callback) {
        request.amount = request.amount || 0
        request.createdBy = request.additionalData.requestedBy
        request.hrnGeneratorSQL = cfg.hrn_sql.generic
        return card.generateOnDemandCard(request, softPinInfo, err => {
            if (err) return callback(err)

            softPinInfo["sSerialNumber"] = softPinInfo["serial_no"]
            softPinInfo["sReloadPin"] = softPinInfo["hrn"]

            delete softPinInfo["serial_no"]
            delete softPinInfo["hrn"]

            return callback()
        })
    },
    "top-up-gw": function (request, softPinInfo, callback) {
        return callback()
    }
}

function getSoftPinInfo(request, softPinInfo, callback) {
    if (!softPinGenerator[request.generationChannel]) {
        return callback(
            resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, `No Soft-Pin generator found for generation channel ${request.generationChannel}`)
        )
    }

    return softPinGenerator[request.generationChannel](request, softPinInfo, callback)
}

function updateSoftPinInfo({ transactionRefId, serialNo, pin }, callback) {
    db.mysql.query(queries.updateSoftPinInfo, [pin, transactionRefId], (err, results, fields) => {
        if (err) {
            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
        }

        return callback()
    })
}

function retrieveUserDataForOrder(userId, container, callback) {
    db.mysql.query(queries.retrieveUserDataForOrder, [userId], function (err, results, fields) {
        if (err) {
            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
        }

        if (results.length === 0) {
            return callback(resGen.responseGenerator(resGen.NOT_FOUND, "User does not exist", resDet.NO_USER_FOUND))
        }

        Object.assign(container, results[0])
        callback()
    })
}

function sendActivityTrackingToReferralEngine(req, callback) {
    const ALLOWED_ROLE_IDS = [7, 8, 15]

    const userInfo = {}
    async.series(
        [
            callback => {
                db.mysql.query(queries.userInfoUsingId, [req.userId], function (err, results, fields) {
                    if (err) {
                        return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                    }

                    if (results.length === 0) {
                        return callback(resGen.responseGenerator(resGen.AUTH_ERR, "UserId does not match", resDet.NO_USER_FOUND))
                    }

                    if (results[0].roleStatus !== 1) {
                        return callback(resGen.responseGenerator(resGen.AUTH_ERR, "User does not have any active role", resDet.NO_ACTIVE_ROLE_FOR_USER))
                    }
                    console.log("pin generation retrieveUserInformationUsingId generated results before: ", results)
                    delete results[0].roleStatus
                    Object.keys(results[0]).forEach(key => (userInfo[key] = results[0][key]))
                    console.log("pin generation retrieveUserInformationUsingId  userInfo: ", userInfo)
                    callback()
                })
            },
            callback => {
                console.log("pin generation retrieveUserInformationUsingId err 847: ", err)
                if (err) {
                    cfg.logger.error(err)
                    return callback()
                }
                console.log("pin generation retrieveUserInformationUsingId userInfo before: ", userInfo)
                if (ALLOWED_ROLE_IDS.indexOf(Number(userInfo.roleId)) === -1) return callback()
                console.log("pin generation retrieveUserInformationUsingId userInfo: ", userInfo)
                let payload = {
                    access_token: cfg.referralCommission.accessToken,
                    username: req.userId,
                    activity_type: "sold",
                    merchant_product_id: req.packageId ? req.packageId : req.productId,
                    amount: req.amount,
                    product_type: req.packageId ? "package" : "product",
                    commission_type: "referral",
                    reference_id: req.refId
                }
                console.log("pin generation retrieveUserInformationUsingId payload: ", payload)
                payload = Object.keys(payload)
                    .map(key => key + "=" + payload[key])
                    .join("&")
                console.log("pin generation retrieveUserInformationUsingId join payload: ", payload)
                console.log("pin generation retrieveUserInformationUsingId url: ", `${cfg.referralCommission.baseUrl}/webhook/platformActivityTracking`)
                request(
                    {
                        url: `${cfg.referralCommission.baseUrl}/webhook/platformActivityTracking`,
                        method: "POST",
                        headers: {
                            "Content-Type": "application/x-www-form-urlencoded"
                        },
                        body: payload
                    },
                    function (err, response, body) {
                        console.log("pin generation retrieveUserInformationUsingId api call response err: ", err)
                        if (err) {
                            cfg.logger.error(err)
                        }

                        // cfg.logger.info(`[Referral Activity Tracking] Request: ${payload}, Response: ${body}`)
                        callback()
                    }
                )
            }
        ],
        err => {
            console.log("sendActivityTrackingToReferralEngine error: ", err)
            callback()
        }
    )
}

function sendActivityTrackingToReferralEngineBU(req, callback) {
    const ALLOWED_ROLE_IDS = [7, 8, 15]

    const userInfo = {}
    console.log("pin generation sendActivityTrackingToReferralEngine 845: ", req)
    user.retrieveUserInformationUsingId(req.userId, userInfo, err => {
        console.log("pin generation retrieveUserInformationUsingId err 847: ", err)
        if (err) {
            cfg.logger.error(err)
            return callback()
        }
        console.log("pin generation retrieveUserInformationUsingId userInfo before: ", userInfo)
        if (ALLOWED_ROLE_IDS.indexOf(Number(userInfo.roleId)) === -1) return callback()
        console.log("pin generation retrieveUserInformationUsingId userInfo: ", userInfo)
        let payload = {
            access_token: cfg.referralCommission.accessToken,
            username: req.userId,
            activity_type: "sold",
            merchant_product_id: req.packageId ? req.packageId : req.productId,
            amount: req.amount,
            product_type: req.packageId ? "package" : "product",
            commission_type: "referral",
            reference_id: req.refId
        }
        console.log("pin generation retrieveUserInformationUsingId payload: ", payload)
        payload = Object.keys(payload)
            .map(key => key + "=" + payload[key])
            .join("&")
        console.log("pin generation retrieveUserInformationUsingId join payload: ", payload)
        console.log("pin generation retrieveUserInformationUsingId url: ", `${cfg.referralCommission.baseUrl}/webhook/platformActivityTracking`)
        request(
            {
                url: `${cfg.referralCommission.baseUrl}/webhook/platformActivityTracking`,
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: payload
            },
            function (err, response, body) {
                console.log("pin generation retrieveUserInformationUsingId api call response err: ", err)
                if (err) {
                    cfg.logger.error(err)
                }

                cfg.logger.info(`[Referral Activity Tracking] Request: ${payload}, Response: ${body}`)
                callback()
            }
        )
    })
}

module.exports = {
    verifyMobileNumber: verifyMobileNumber,
    verifyMobileNumberForBulkOrder: verifyMobileNumberForBulkOrder,
    checkOrderRequest: function (input, data, callback) {
        let connection
        if (!input.amount) input.amount = -1
        let paymentMethodInfo = []
        let digiWalletInfo = {}
        data.paymentMethods = []
        async.series(
            [
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
                    let checkUserBalance = input.checkUserBalance === undefined ? 1 : input.checkUserBalance
                    let channel = input.channel === undefined ? -1 : input.channel
                    let replacements = [input.productId, input.amount, input.salesAmount, input.currencyId, input.userId, checkUserBalance, channel]
                    connection.query(queries.checkOrderInfo, replacements, function (err, results, fields) {
                        if (err) {
                            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                        }

                        return callback()
                    })
                },
                callback => {
                    connection.query(queries.getOrderInfo, [], function (err, results, fields) {
                        if (err || results.length <= 0) {
                            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                        }

                        let orderInfo = results[0]
                        if (orderInfo["@error"] === 1) {
                            return callback(
                                resGen.responseGenerator(resGen.ACTION_NOT_SUPPORTED_ERR, orderInfo["@errorDescription"], orderInfo["@errorCode"])
                            )
                        }
                        cfg.logger.info(`PARTNERTOPUPCHECK original data:`, data)
                        data.amount = parseFloat(parseFloat(orderInfo["@originalAmount"]).toFixed(2))
                        data.deductibleAmount = parseFloat(parseFloat(orderInfo["@deductibleAmount"]).toFixed(2))
                        data.product_service_charge = parseFloat(parseFloat(orderInfo["@product_service_charge"]).toFixed(2))
                        data.product_service_charge_rate = parseFloat(parseFloat(orderInfo["@product_service_charge_rate"]).toFixed(2))
                        data.product_service_charge_type = orderInfo["@product_service_charge_type"]
                        data.userOriginCurrencyConversionRate = orderInfo["@userOriginCurrencyConversionRate"]
                        let deductibleAmountInOriginCurrency = parseFloat(data.deductibleAmount * parseFloat(orderInfo["@userOriginCurrencyConversionRate"]))
                        data.deductibleAmountInOriginCurrency = Math.trunc(deductibleAmountInOriginCurrency * 100) / 100
                        data.comission = parseFloat(parseFloat(orderInfo["@comission"]).toFixed(2))
                        data.discount = parseFloat(parseFloat(orderInfo["@discount"]).toFixed(2))
                        
                        callback()
                    })
                },
                callback => {
                    if (!input.userId) return callback()

                    connection.query(
                        queries.getOrVerifyProductWiseWalletTypeID,
                        [input.productId, input.userId, 0, 1, data.deductibleAmount, "", "", ""],
                        function (err, results, fields) {
                            if (err) {
                                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                            }

                            console.log(data)
                            if (results.length > 0) {
                                data.walletDetails = results[0]
                            } else {
                                data.walletDetails = []
                            }
                            return callback()
                        }
                    )
                    cfg.logger.info(`PARTNERTOPUPCHECK data after calculation (called the core platform procedure):`, data)
                },
                callback => {
                    wallet.fetchPartnerUsageLimitConfiguration(callback)
                },
                callback => {
                    if (!input.userId) return callback()
                    wallet.digiWalletLimitProcess(input.userId, digiWalletInfo, callback)
                },
                callback => {
                    cfg.logger.info(`PARTNERTOPUPCHECK digiWalletInfo:`, digiWalletInfo)

                    if (!input.userId || cfg.voiceBillPayment.channels.includes(input.channel)) return callback()
                    connection.query(walletQueries.getProductPaymentMethods, [input.userId, input.productId], function (err, results, fields) {
                        if (err) {
                            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                        }

                        if (results.length > 0) data.paymentMethods.push(...results)
                        callback()
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
    },
    checkOrderRequestForMobile: function (input, data, callback) {
            let connection
            if (!input.amount) input.amount = -1
            let paymentMethodInfo = []
            let partnerBWalletInfo = {}
            data.paymentMethods = []
            async.series(
                [
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
                        let checkUserBalance = input.checkUserBalance === undefined ? 1 : input.checkUserBalance
                        let channel = input.channel === undefined ? -1 : input.channel
                        let replacements = [input.productId, input.amount, input.salesAmount, input.currencyId, input.userId, checkUserBalance, channel]
                        connection.query(queries.checkOrderInfo, replacements, function (err, results, fields) {
                            if (err) {
                                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                            }

                            return callback()
                        })
                    },
                    callback => {
                        connection.query(queries.getOrderInfo, [], function (err, results, fields) {
                            if (err || results.length <= 0) {
                                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                            }

                            let orderInfo = results[0]
                            if (orderInfo["@error"] === 1) {
                                return callback(
                                    resGen.responseGenerator(resGen.ACTION_NOT_SUPPORTED_ERR, orderInfo["@errorDescription"], orderInfo["@errorCode"])
                                )
                            }

                            data.amount = parseFloat(parseFloat(orderInfo["@originalAmount"]).toFixed(2))
                            data.deductibleAmount = parseFloat(parseFloat(orderInfo["@deductibleAmount"]).toFixed(2))
                            data.product_service_charge = parseFloat(parseFloat(orderInfo["@product_service_charge"]).toFixed(2))
                            data.product_service_charge_rate = parseFloat(parseFloat(orderInfo["@product_service_charge_rate"]).toFixed(2))
                            data.product_service_charge_type = orderInfo["@product_service_charge_type"]
                            let deductibleAmountInOriginCurrency = parseFloat(data.deductibleAmount * parseFloat(orderInfo["@userOriginCurrencyConversionRate"]))
                            data.deductibleAmountInOriginCurrency = Math.trunc(deductibleAmountInOriginCurrency * 100) / 100
                            data.comission = parseFloat(parseFloat(orderInfo["@comission"]).toFixed(2))
                            data.discount = parseFloat(parseFloat(orderInfo["@discount"]).toFixed(2))

                            callback()
                        })
                    },
                    callback => {
                        if (!input.userId) return callback()

                        connection.query(
                            queries.getOrVerifyProductWiseWalletTypeID,
                            [input.productId, input.userId, 0, 1, data.deductibleAmount, "", "", ""],
                            function (err, results, fields) {
                                if (err) {
                                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                                }

                                console.log(data)
                                if (results.length > 0) {
                                    data.walletDetails = results[0]
                                } else {
                                    data.walletDetails = []
                                }
                                return callback()
                            }
                        )
                    },
                    callback => {
                        if (!input.userId || cfg.voiceBillPayment.channels.includes(input.channel)) return callback()
                        connection.query(walletQueries.getProductPaymentMethods, [input.userId, input.productId], function (err, results, fields) {
                            if (err) {
                                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                            }

                            if (results.length > 0) data.paymentMethods.push(...results)
                            callback()
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
    },
    getDeductibleAmount: function (input, data, callback) {
        let connection = null
        async.series(
            [
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
                    const checkUserBalance = 0
                    const channel = input.channel === undefined ? -1 : input.channel
                    const replacements = [input.productId, input.amount, input.salesAmount, input.currencyId, input.userId, checkUserBalance, channel]
                    console.log("replacements: ", replacements)

                    connection.query(queries.checkOrderInfo, replacements, function (err, results, fields) {
                        if (err) {
                            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                        }

                        return callback()
                    })
                },
                callback => {
                    connection.query(queries.getOrderInfo, [], function (err, results, fields) {
                        if (err || results.length <= 0) {
                            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                        }

                        let orderInfo = results[0]
                        if (orderInfo["@error"] === 1) {
                            console.error("Check order-info error: ", orderInfo["@error"])
                            return callback(
                                resGen.responseGenerator(resGen.ACTION_NOT_SUPPORTED_ERR, orderInfo["@errorDescription"], orderInfo["@errorCode"])
                            )
                        }

                        data.deductibleAmount = parseFloat(parseFloat(orderInfo["@deductibleAmount"]).toFixed(2))
                        callback()
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
    },
    checkOrderRequestSalePortal: function (input, data, callback) {
        let connection
        if (!input.amount) input.amount = -1

        async.series(
            [
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
                    let checkUserBalance = input.checkUserBalance === undefined ? 1 : input.checkUserBalance
                    let replacements = [input.productId, input.amount, input.salesAmount, input.currencyId, input.userId, checkUserBalance]
                    connection.query(queries.checkOrderInfo, replacements, function (err, results, fields) {
                        if (err) {
                            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                        }

                        return callback()
                    })
                },
                callback => {
                    connection.query(queries.getOrderInfo, [], function (err, results, fields) {
                        if (err || results.length <= 0) {
                            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                        }

                        let orderInfo = results[0]
                        if (orderInfo["@error"] === 1) {
                            return callback(
                                resGen.responseGenerator(resGen.ACTION_NOT_SUPPORTED_ERR, orderInfo["@errorDescription"], orderInfo["@errorCode"])
                            )
                        }

                        data.amount = parseFloat(parseFloat(orderInfo["@originalAmount"]).toFixed(2))
                        data.deductibleAmount = parseFloat(parseFloat(orderInfo["@deductibleAmount"]).toFixed(2))
                        data.comission = parseFloat(parseFloat(orderInfo["@comission"]).toFixed(2))
                        data.discount = parseFloat(parseFloat(orderInfo["@discount"]).toFixed(2))
                        callback()
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
    },

    retrieveOrderConfigurationData: function (userId, productCategoryId, orderConf, callback) {
        db.mysql.query(queries.retrieveConfigurationDataForOrder, [userId, productCategoryId], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            if (results.length === 0) {
                Object.assign(orderConf, { passwordAuth: 0, emailAuth: 0 })
                return retrieveUserDataForOrder(userId, orderConf, callback)
            }

            Object.keys(results[0]).forEach(key => (orderConf[key] = results[0][key]))
            callback()
        })
    },
    retrieveExecutionTaskInformation: retrieveExecutionTaskInformation,
    requestToExecutionEngine: requestToExecutionEngine,
    fetchDiscountList: function (filters, data, callback) {
        let replacements = [filters.roleId, filters.userId, filters.categoryId, filters.categoryId]

        db.mysql.query(queries.discounts, replacements, function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            data.push(...results)
            callback()
        })
    },
    retrieveExecutionHistoryUsingSerialNo: function (cardInfo, serialBlockInfo, data, callback) {
        let partition = getExecutionHistoryPartition(cardInfo.orderDate)
        let done = false

        async.series(
            [
                callback => {
                    db.mysql.query(
                        queries.executionHistoryForScratchCard("PARTITION (" + partition + ")"),
                        [cardInfo.serialNo, cardInfo.orderDate],
                        function (err, results, fields) {
                            if (err || results.length === 0) return callback()

                            for (let index in results) {
                                let result = results[index]
                                if (result["canShowAmount"] === 1) {
                                    delete result["Product"]
                                } else {
                                    delete result["Amount"]
                                }

                                delete result["canShowAmount"]
                            }

                            data.push(...results)

                            done = true
                            callback()
                        }
                    )
                },
                callback => {
                    if (done) return callback()
                    db.mysql.query(queries.executionHistoryForScratchCard(""), [cardInfo.serialNo, cardInfo.orderDate], function (err, results, fields) {
                        if (err || results.length === 0) {
                            delete serialBlockInfo["Status"]
                            serialBlockInfo["Execution Status"] = "This pin is used earlier."
                            return callback()
                        }

                        for (let index in results) {
                            let result = results[index]
                            if (result["canShowAmount"] === 1) {
                                delete result["Product"]
                            } else {
                                delete result["Amount"]
                            }

                            delete result["canShowAmount"]
                        }

                        data.push(...results)

                        done = true
                        callback()
                    })
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
    checkForDuplicateOrderRequest: checkForDuplicateOrderRequest,
    setForDuplicateOrderRequest: setForDuplicateOrderRequest,
    removeForDuplicateOrderRequest: removeForDuplicateOrderRequest,
    storeBulkOrderRequests: function (orderInfo, container, callback) {
        container.batchId = uuidv1()

        let multi = db.redis.multi()
        multi.lpush(queries.keyForBulkOrderRequests(container.batchId), ...orderInfo)
        multi.set(queries.keyForBulkOrderRequestInfo(container.batchId), orderInfo.length, "EX", cfg.ttl.bulkorder)
        multi.expire(queries.keyForBulkOrderRequests(container.batchId), cfg.ttl.bulkorder)

        multi.exec(function (err, replies) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            return callback()
        })
    },
    checkIfBatchIdExists: function (batchId, bulkOrderInfo, callback) {
        db.redis.get(queries.keyForBulkOrderRequestInfo(batchId), function (err, reply) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            if (!reply) {
                return callback(resGen.responseGenerator(resGen.NOT_FOUND))
            }

            bulkOrderInfo.batchSize = Number(reply)

            let multi = db.redis.multi()
            multi.persist(queries.keyForBulkOrderRequests(batchId))
            multi.del(queries.keyForBulkOrderRequestInfo(batchId))

            multi.exec(function (err, replies) {
                if (err) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                }

                return callback()
            })
        })
    },
    fetchThirdPartyTrxIdMap: function (thirdPartyTrxId, container, callback) {
        db.redis.get(queries.keyForThirdPartyTrxIdMap(thirdPartyTrxId), function (err, reply) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            if (!reply) {
                return db.mysql.query(queries.executionTransactionId, [thirdPartyTrxId], function (err, results, fields) {
                    if (err) {
                        return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                    }

                    if (results.length === 0) {
                        return callback(resGen.responseGenerator(resGen.NOT_FOUND))
                    }

                    container.transactionId = results[0].transactionId
                    callback()
                })
            }

            container.transactionId = reply
            db.redis.del(queries.keyForThirdPartyTrxIdMap(thirdPartyTrxId), function (err, reply) {
                return callback()
            })
        })
    },
    batchOrderRequestToExecutionEngine: function (orderRequests, transactionRefId) {
        async.eachOfSeries(
            orderRequests,
            function (item, key, callback) {
                item.transactionRefId = transactionRefId
                let executionResponse = {}
                requestToExecutionEngine(item, executionResponse, err => {
                    // Log the err event.
                    return callback()
                })
            },
            err => {
                // Log this event.
            }
        )
    },
    bulkOrderRequestToExecutionEngine: function (batchId, batchSize, requestedUserId, requestedBy) {
        let templateReq = {
            transactionType: "TRANSACTION",
            executionConfigId: cfg.executionConfigIdMapping.TOP_UP,
            channel: "bulk-order",
            userId: requestedUserId,
            additionalData: {
                executionType: utils.executionType.TOP_UP,
                requestedBy: requestedBy
            }
        }

        async.doUntil(
            callback => {
                retrieveExecutionTaskInformation(templateReq.executionConfigId, templateReq.additionalData, err => {
                    if (err) {
                        return callback(null, err)
                    }

                    callback(resGen.SUCCESS)
                })
            },
            err => {
                return err === undefined
            },
            (err, results) => {
                let firstTime = true
                let timer
                async.doUntil(
                    callback => {
                        timer = setTimeout(
                            () => {
                                batchRequestReplayToExecutionEngine(batchId, batchSize, templateReq, err => {
                                    if (err) {
                                        return callback(null, err)
                                    }

                                    callback(resGen.SUCCESS)
                                })
                            },
                            firstTime ? 0 : 10000
                        )

                        firstTime = false
                    },
                    err => {
                        return err === undefined
                    },
                    (err, results) => {
                        if (timer) {
                            clearTimeout(timer)
                        }
                        // Log this event!
                        // console.log(err);
                    }
                )
            }
        )
    },

    bulkOrderGenericRequestToExecutionEngine: function (batchId, batchSize, requestedUserId, requestedBy) {
        const formattedDate = [
            new Date().getUTCFullYear().toString().slice(-2),
            ('0' + (new Date().getUTCMonth() + 1)).slice(-2),
            ('0' + new Date().getUTCDate()).slice(-2),
            ('0' + new Date().getUTCHours()).slice(-2),
            ('0' + new Date().getUTCMinutes()).slice(-2),
            ('0' + new Date().getUTCSeconds()).slice(-2)
        ].join('');

        let templateReq = {
            transactionType: "TRANSACTION",
            executionConfigId: cfg.executionConfigIdMapping.TOP_UP,
            channel: `bulk-order-generic-${requestedUserId}-${formattedDate}`,
            userId: requestedUserId,
            additionalData: {
                executionType: utils.executionType.TOP_UP,
                requestedBy: requestedBy
            }
        }

        async.doUntil(
            callback => {
                retrieveExecutionTaskInformation(templateReq.executionConfigId, templateReq.additionalData, err => {
                    if (err) {
                        return callback(null, err)
                    }

                    callback(resGen.SUCCESS)
                })
            },
            err => {
                return err === undefined
            },
            (err, results) => {
                let firstTime = true
                let timer
                async.doUntil(
                    callback => {
                        timer = setTimeout(
                            () => {
                                batchRequestReplayToExecutionEngine(batchId, batchSize, templateReq, err => {
                                    if (err) {
                                        return callback(null, err)
                                    }

                                    callback(resGen.SUCCESS)
                                })
                            },
                            firstTime ? 0 : 10000
                        )

                        firstTime = false
                    },
                    err => {
                        return err === undefined
                    },
                    (err, results) => {
                        if (timer) {
                            clearTimeout(timer)
                        }
                        // Log this event!
                        // console.log(err);
                    }
                )
            }
        )
    },
    verifyAndGenerateOrderRequest: function (request, cardInfo, productsInfo, orderRequests, callback) {
        let interval = request.dupOrderInfo.counter === 1 ? 0 : request.dupOrderInfo.interval
        let isDataPack = false

        async.eachOfSeries(
            productsInfo,
            function (item, key, callback) {
                let mobileNumberInfo = {}
                verifyMobileNumber(
                    request.mobileNo,
                    mobileNumberInfo,
                    err => {
                        if (err) {
                            return callback(err)
                        }

                        let executionConfig = cfg.categoryWiseExecutionConfig[item.productCategoryId]
                        if (!executionConfig)
                            return callback(
                                resGen.responseGenerator(
                                    resGen.INTERNAL_SERVER_ERROR,
                                    `No execution configuration id found for product category id [${item.productCategoryId}]`
                                )
                            )

                        let currencyId = currency.getCurrencyIdForCountry(mobileNumberInfo.country)
                        if (!currencyId) return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, "Country not supported"))

                        if (!isDataPack && item.ref7 === "0") isDataPack = true
                        interval = interval + (item.executeAfter || 0)

                        orderRequests.push({
                            transactionType: "TRANSACTION",
                            executionConfigId: item.executionConfigId,
                            productId: item.productId,
                            packageId: cardInfo.packageId || -1,
                            currencyId: currencyId,
                            amount: cardInfo.activeValueType === 0 ? cardInfo.amount : item.productValue,
                            mobileNo: mobileNumberInfo.mobileNumber,
                            sender: request.senderNumber || "NA",
                            operator: mobileNumberInfo.operator,
                            channel: request.channel,
                            interval: interval,
                            userId: request.userId === 0 ? -1 : request.userId,
                            additionalData: {
                                executionType: executionConfig.executionType,
                                salesAmount: cardInfo.activeValueType === 0 ? cardInfo.salesAmount : item.salesValue,
                                requestedBy: request.username,
                                productSerialNo: cardInfo.serialNo,
                                connectionType: item.ref2 || "0",
                                operatorCode: mobileNumberInfo.operatorCode
                            }
                        })
                        return callback()
                    },
                    { operator: item.ref1, operatorCode: item.ref3, checkPrefix: item.ref4 === "1" }
                )
            },
            err => {
                if (err) {
                    return callback(err)
                }

                request.isDataPack = isDataPack
                return callback()
            }
        )
    },
    fetchExecutionStatus: function (filters, transactionInfo, callback) {
        let condition = utils.generateDynamicWhereCondition(
            ["execution_transaction_ref_id", "execution_client_transaction_id"],
            [filters.transactionRefId, filters.clientTrxId]
        )

        db.mysql.query(queries.executionStatus(condition.whereCondition), condition.replacements, function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            if (results.length === 0) {
                return callback(
                    resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, filters.transactionRefId !== undefined ? "Incorrect tid" : "Incorrect customer_tid")
                )
            }

            Object.assign(transactionInfo, results[0])
            callback()
        })
    },
    generateSoftPins: function ({ executionRequests, productInfo, generationChannel }, responses, callback) {
        const giftUserBalanceRequest = {}
        let amount = 0
        let transactionRefId

        if (executionRequests.length > 0) {
            giftUserBalanceRequest["productId"] = executionRequests[0]["productId"]
            giftUserBalanceRequest["userId"] = executionRequests[0]["userId"]
            giftUserBalanceRequest["channel"] = executionRequests[0]["channel"]
        }

        async.eachOfSeries(
            executionRequests,
            (executionRequest, key, callback) => {
                let executionResponse = {}
                let data = {}
                let softPinInfo = {}

                async.series(
                    [
                        callback => {
                            requestToExecutionEngine(executionRequest, executionResponse, callback)
                        },
                        callback => {
                            if (executionResponse.code === cfg.engine.success) {
                                Object.assign(data, executionResponse.data[0])
                                amount += Number(executionResponse.data[0]["deductedAmount"])
                                executionRequest.transactionRefId = executionResponse.data[0]["transactionId"]
                                return callback()
                            }

                            return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, executionResponse.details))
                        },
                        callback => {
                            executionRequest.generationChannel = generationChannel
                            cfg.logger.info("Soft-Pin-Info: " + JSON.stringify(executionRequest));
                            getSoftPinInfo(executionRequest, softPinInfo, callback)
                        },
                        callback => {
                            data["emailAuthentication"] = 0
                            if (generationChannel === "top-up-gw") {
                                responses.push(data)
                                return callback()
                            }

                            data["serialNo"] = softPinInfo["sSerialNumber"]
                            data["pin"] = softPinInfo["sReloadPin"]
                            data["instructionText"] = productInfo["ref6"] || productInfo["reference6"]
                            // Remove usage reference 4 as support text. Empty string used for backward compatibility.
                            data["supportText"] = "" // productInfo['ref4'] || productInfo['reference4'];
                            responses.push(data)

                            updateSoftPinInfo(
                                {
                                    transactionRefId: data["transactionId"],
                                    serialNo: softPinInfo["sSerialNumber"],
                                    pin: softPinInfo["sReloadPin"]
                                },
                                callback
                            )
                        }
                    ],
                    err => {
                        cfg.logger.info(
                          "pin generation generateSoftPins inside error: " + err
                        );
                        console.log("pin generation generateSoftPins inside error: ", err)
                        if (err && key + 1 === executionRequests.length && responses.length === 0) {
                            return callback(err)
                        }

                        if (err) {
                            cfg.logger.error(err)
                        }

                        return callback()
                    }
                )
            },
            err => {
                cfg.logger.info(
                  "pin generation generateSoftPins outside error: " +
                    err +
                    "Response: " +
                    JSON.stringify(responses)
                );
                if (err && responses.length === 0) {
                    return callback(err)
                }

                if (err) {
                    cfg.logger.error(err)
                }

                giftUserBalanceRequest["amount"] = amount
                giftUserBalanceRequest["refId"] = "c_" + transactionRefId
                return fundTransfer.doGiftUserBalance(giftUserBalanceRequest, () => {
                    giftUserBalanceRequest["refId"] = "r_" + transactionRefId
                    console.log("pin generation doGiftUserBalance: ", giftUserBalanceRequest)
                    return sendActivityTrackingToReferralEngine(giftUserBalanceRequest, callback)
                })
            }
        )
    },
    checkForDuplicateTransactionCallback: function (transactionRefId, callback) {
        db.redis.get(queries.keyForTransactionCallback(transactionRefId), (err, reply) => {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            if (reply) {
                return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, "Duplicate Transaction-Ref-Id"))
            }

            return callback()
        })
    },
    setForDuplicateTransactionCallback: function (transactionRefId, callback) {
        db.redis.set(queries.keyForTransactionCallback(transactionRefId), transactionRefId, "EX", 3600, function (err, reply) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            callback()
        })
    },
    requestMapForBillPayment: function ({ purpose, executionConfigId, productRefId, request }, callback) {
        if (!BILL_PAYMENT[executionConfigId] || !BILL_PAYMENT[executionConfigId][`${purpose}Map`]) return callback()

        return BILL_PAYMENT[executionConfigId][`${purpose}Map`](productRefId, request, callback)
    },
    preProcessBillPaymentInformation: function (controlRequest, keyValuePairs, callback) {
        if (!BILL_PAYMENT[controlRequest.executionConfigId] || !BILL_PAYMENT[controlRequest.executionConfigId].preProcess) return callback()

        return BILL_PAYMENT[controlRequest.executionConfigId].preProcess(keyValuePairs, { purpose: controlRequest.purpose }, callback)
    },
    getBillPaymentInformation: function (paymentInfoRequest, paymentInfoResponse, callback) {
        if (!BILL_PAYMENT[paymentInfoRequest.executionConfigId] || !BILL_PAYMENT[paymentInfoRequest.executionConfigId].info) return callback()

        return BILL_PAYMENT[paymentInfoRequest.executionConfigId].info(paymentInfoRequest, paymentInfoResponse, callback)
    },
    responseMergeForBillPayment: function ({ executionConfigId, productRefId, paymentInfo, productInfo }, container, callback) {
        if (!BILL_PAYMENT[executionConfigId] || !BILL_PAYMENT[executionConfigId].infoMerge) return callback()

        return BILL_PAYMENT[executionConfigId].infoMerge({ productRefId, paymentInfo, productInfo }, container, callback)
    },
    checkBillPaymentInfo: function ({ executionConfigId, productRefId, billPaymentInfo }, container, callback) {
        if (!BILL_PAYMENT[executionConfigId] || !BILL_PAYMENT[executionConfigId].infoCheck) return callback()

        return BILL_PAYMENT[executionConfigId].infoCheck({ productRefId, billPaymentInfo }, container, callback)
    },
    paymentMergeForBillPayment: function ({ executionConfigId, productRefId, request, paymentInfo, productInfo }, container, callback) {
        if (!BILL_PAYMENT[executionConfigId] || !BILL_PAYMENT[executionConfigId].paymentMerge) return callback()

        return BILL_PAYMENT[executionConfigId].paymentMerge({ productRefId, request, paymentInfo, productInfo }, container, callback)
    },
    exeReqFieldMapForBillPayment: function (executionConfigId, executionRequest, request, callback) {
        if (!BILL_PAYMENT[executionConfigId] || !BILL_PAYMENT[executionConfigId].exeReqFieldMap) return callback()

        return BILL_PAYMENT[executionConfigId].exeReqFieldMap(executionRequest, request, callback)
    },
    keepExecutionHistory: function (input, callback) {
        let replacements = [
            input.clientTrxId,
            input.executionType,
            input.productId,
            input.serialNo,
            input.amount,
            input.salesAmount,
            input.currencyId,
            input.mobileNo,
            input.channel,
            input.createdBy
        ]
        db.mysql.query(queries.storeExecutionRecord, replacements, function (err, results, fields) {
            return callback()
        })
    },
    sendActivityTrackingToReferralEngine: sendActivityTrackingToReferralEngine,

    setKeyForPartnerTransactions: function (transactionId, callback) {
        db.redis.set(queries.keyForPartnerTransactions(transactionId), 1, "EX", 3600, function (err, reply) {
            // console.log("inside setKeyForPartnerTransactions")
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }
            // console.log("redis reply: ", reply)

            return callback()
        })
    },

    getPartnerTransactionInfo: function (transactionId, paymentMethodInfo, callback) {
        async.series(
            [
                callback => {
                    db.redis.get(queries.keyForPartnerTransactions(transactionId), function (err, reply) {
                        if (err) {
                            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                        }

                        if (reply) Object.assign(paymentMethodInfo, { isPartner: reply })
                        callback()
                    })
                },
                callback => {
                    // delete redis entry
                    db.redis.del(queries.keyForPartnerTransactions(transactionId), function (err, reply) {
                        if (err) {
                            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                        }

                        callback()
                    })
                }
            ],
            err => {
                if (err) return callback(err)

                return callback()
            }
        )
    },
    fetchProductCategoryInfo: function (productId, productInfo, callback) {
        db.mysql.query(queries.fetchProductCategoryInfo, [productId], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            if (results.length) Object.assign(productInfo, results[0])

            return callback()
        })
    },
    updateUserPaymentMethodData: function (input, callback) {
        let container = {}
        async.series([
            callback => {
                if (input.checkOrderInfo && input.checkOrderInfo === 'N') {
                    container.deductibleAmount = input.amount
                    return callback()
                }

                input.salesAmount = -1
                input.checkUserBalance = 0
                this.getDeductibleAmount(input, container, callback);
            },
            callback => {
                wallet.changeUserPaymentMethodData(container.deductibleAmount, input.userId, input.paymentMethodId, undefined, callback)
            }
        ], err => {
            if (err) return callback(err)

            callback()
        })
    }
}
