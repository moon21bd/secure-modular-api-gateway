"use strict"

const request = require("request")
const async = require("async")

const order = require("../components/order")
const th = require("../lib/tokenhandler")

const resGen = require("../lib/result.codes")
const config = require("../config")

function marvelCommTopUpDatapackCallback(cbRequest, options, callback) {
    if (!options || !options.url) {
        return callback(resGen.responseGenerator(resGen.REQUIRED_PARAMS_ERR, "No Request-URL found"))
    }

    if (!cbRequest || !cbRequest.transactionRefId || cbRequest.status === undefined) {
        return callback(resGen.responseGenerator(resGen.REQUIRED_PARAMS_ERR, "Required fields are missing"))
    }

    let container = {}

    async.series(
        [
            callback => {
                order.retrieveExecutionTaskInformation(config.executionConfigIdMapping["PLATFORM_CASH"], container, callback)
            },
            callback => {
                let content = {
                    tid: cbRequest.transactionRefId,
                    status: cbRequest.status === 1 ? "success" : "fail",
                    message: cbRequest.status === 1 ? "Transaction successful" : "Transaction failed"
                }

                request(
                    {
                        url: options.url,
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": container["Authorization"]
                        },
                        json: true,
                        body: content
                    },
                    function (err, response, body) {
                        if (err) {
                            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                        }

                        config.logger.info("URL: " + options.url + ", Request: " + JSON.stringify(content) + ", Response: " + JSON.stringify(body))
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
}

function genericTransactionCallback(cbRequest, options, callback) {
    if (!options || !options.url) {
        return callback(resGen.responseGenerator(resGen.REQUIRED_PARAMS_ERR, "No Request-URL found"))
    }

    if (!cbRequest || !cbRequest.transactionRefId || cbRequest.status === undefined) {
        return callback(resGen.responseGenerator(resGen.REQUIRED_PARAMS_ERR, "Required fields are missing"))
    }

    let payload = {
        tid: cbRequest.transactionRefId,
        status: cbRequest.status,
        message: cbRequest.status === 1 ? "Transaction successful" : "Transaction failed"
    }

    let container = {}
    async.series(
        [
            callback => {
                if (!options.keyId) return callback()

                th.encryptPayload(payload, options.keyId, container, callback)
            },
            callback => {
                request(
                    {
                        url: options.url,
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        json: true,
                        body: Object.keys(container).length === 0 ? payload : { payload: container.payload }
                    },
                    function (err, response, body) {
                        if (err) {
                            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                        }

                        config.logger.info(
                            "URL: " +
                                options.url +
                                ", Request: " +
                                JSON.stringify(Object.keys(container).length === 0 ? payload : { payload: container.payload }) +
                                ", Response: " +
                                JSON.stringify(body)
                        )

                        container.body = body
                        callback()
                    }
                )
            },
            callback => {
                if (container.body.code !== 0 && container.body.resend === 1) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR))
                }

                return callback()
            }
        ],
        err => {
            if (err) {
                return callback(err)
            }

            return callback()
        }
    )
}

function transactionCallbackForPartnerVoice(cbRequest, username, options, callback) {
    if (!options || !options.url) {
        return callback(resGen.responseGenerator(resGen.REQUIRED_PARAMS_ERR, "No Request-URL found"))
    }

    if (!cbRequest || !cbRequest.transactionRefId || cbRequest.status === undefined) {
        return callback(resGen.responseGenerator(resGen.REQUIRED_PARAMS_ERR, "Required fields are missing"))
    }

    let payload = {
        userName: username,
        transactionId: cbRequest.transactionRefId,
        status: cbRequest.status,
        message: cbRequest.status === 1 ? "Transaction successful" : "Transaction failed",
        deductedAmount: cbRequest.deductedAmount
    }

    if (options.productInfo) payload.transactionType = options.productInfo.categoryName

    console.log("Trx callback - digi payload: ", payload)

    let container = {}
    async.series(
        [
            callback => {
                if (!options.keyId) return callback()

                th.encryptPayload(payload, options.keyId, container, callback)
            },
            callback => {
                request(
                    {
                        url: options.url,
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        json: true,
                        body: Object.keys(container).length === 0 ? payload : { payload: container.payload }
                    },
                    function (err, response, body) {
                        if (err) {
                            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                        }

                        config.logger.info(
                            "URL: " +
                                options.url +
                                ", Request: " +
                                JSON.stringify(Object.keys(container).length === 0 ? payload : { payload: container.payload }) +
                                ", Response: " +
                                JSON.stringify(body)
                        )

                        container.body = body
                        callback()
                    }
                )
            },
            callback => {
                if (container.body.code !== 0 && container.body.resend === 1) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR))
                }

                return callback()
            }
        ],
        err => {
            if (err) {
                return callback(err)
            }

            return callback()
        }
    )
}

// transaction callback for channelB
function tngTransactionCallback(cbRequest, username, options, callback) {
    if (!options || !options.url) {
        return callback(resGen.responseGenerator(resGen.REQUIRED_PARAMS_ERR, "No Request-URL found"))
    }

    if (!cbRequest || !cbRequest.transactionRefId || cbRequest.status === undefined) {
        return callback(resGen.responseGenerator(resGen.REQUIRED_PARAMS_ERR, "Required fields are missing"))
    }

    let payload = {
        trxId: cbRequest.transactionRefId,
        trxStatus: cbRequest.status === 1 ? "success" : "failed"
    }
    cbRequest.status !== 1 && (payload.failedReason = "Transaction failed")

    let container = {}
    async.series(
        [
            callback => {
                request(
                    {
                        url: options.url,
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        json: true,
                        body: payload
                    },
                    function (err, response, body) {
                        if (err) {
                            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                        }

                        config.logger.info("URL: " + options.url + ", Request: " + JSON.stringify(payload) + ", Response: " + JSON.stringify(body))

                        container.body = body
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
}


// transaction callback for mobile voice
function mobileVoiceTransactionCallback(cbRequest, username, options, callback) {
    if (!options || !options.url) {
        return callback(resGen.responseGenerator(resGen.REQUIRED_PARAMS_ERR, "No Request-URL found"))
    }

    if (!cbRequest || !cbRequest.transactionRefId || cbRequest.status === undefined) {
        return callback(resGen.responseGenerator(resGen.REQUIRED_PARAMS_ERR, "Required fields are missing"))
    }

    let payload = {
        tid: cbRequest.transactionRefId,
        status: cbRequest.status === 1 ? "success" : "failed",
        message: cbRequest.status === 1 ? "Transaction successful" : "Transaction failed"
    }
    cbRequest.status !== 1 && (payload.failedReason = "Transaction failed")

    // console.log('cbRequest', cbRequest)

    let container = {}
    async.series(
        [
            callback => {
                request(
                    {
                        url: options.url,
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        json: true,
                        body: payload
                    },
                    function (err, response, body) {
                        if (err) {
                            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                        }

                        config.logger.info("URL: " + options.url + ", Request: " + JSON.stringify(payload) + ", Response: " + JSON.stringify(body))

                        container.body = body
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
}

function genericTransactionCallbackWithMessage(
  cbRequest,
  username,
  options,
  callback
) {
  if (!options || !options.url) {
    return callback(
      resGen.responseGenerator(
        resGen.REQUIRED_PARAMS_ERR,
        "No Request-URL found"
      )
    );
  }

  if (
    !cbRequest ||
    !cbRequest.transactionRefId ||
    cbRequest.status === undefined
  ) {
    return callback(
      resGen.responseGenerator(
        resGen.REQUIRED_PARAMS_ERR,
        "Required fields are missing"
      )
    );
  }

  let payload = {
    tid: cbRequest.transactionRefId,
    status: cbRequest.status === 1 ? "success" : "failed",
    message: cbRequest.message,
    message_details: cbRequest.message_details,
  };

  let container = {};
  async.series(
    [
      (callback) => {
        request(
          {
            url: options.url,
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            json: true,
            body: payload,
          },
          function (err, response, body) {
            if (err) {
              return callback(
                resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err)
              );
            }

            config.logger.info(
              "genericTransactionCallbackWithMessage-URL: " +
                options.url +
                ", Request: " +
                JSON.stringify(payload) +
                ", Response: " +
                JSON.stringify(body)
            );

            container.body = body;
            callback();
          }
        );
      },
    ],
    (err) => {
      if (err) {
        return callback(err);
      }

      return callback();
    }
  );
}

module.exports = {
    "9455": {
        func: marvelCommTopUpDatapackCallback,
        options: {
            url: config.platformCash.domain + "/api/s1/purchase-cb"
        }
    },

    "parent15881": {
        func: transactionCallbackForPartnerVoice,
        options: {
            url: "https://api.example.com/api/send_sms",
            keyId: ""
        }
    },
    "paymentMethod1": {
        func: transactionCallbackForPartnerVoice,
        options: {
            url: "https://api.example.com/api/send_sms",
            keyId: ""
        }
    },
    "119825": {
        func: genericTransactionCallback,
        options: {
            url: "https://api.sheba.xyz/v2/top-up/bdorder/status"
        }
    },
    "parent180304": {
        func: tngTransactionCallback,
        options: {
            url: "https://channelB.acme.com.sg/api/webhook/trx-status",
            keyId: ""
        }
    },
    "channel_tng": {
        func: tngTransactionCallback,
        options: {
            url: "https://channelB.acme.com.sg/api/webhook/trx-status",
            keyId: ""
        }
    },
    "channel_um_voice": {
        func: mobileVoiceTransactionCallback,
        options: {
            url: config.mobile.callbackUrl,
            keyId: ""
        }
    },
    /* "channel_web": {
        func: genericTransactionCallbackWithMessage,
        options: {
            url: "http://localhost:4000/webhook",
            keyId: ""
        }
    } */
}
