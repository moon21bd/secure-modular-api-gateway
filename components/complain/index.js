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
const cfg = require("../../config")
const func = require("joi/lib/types/func")
const object = require("joi/lib/types/object")
const fundTransfer = require("../../components/fund_transfer")

module.exports = {
    checkJompayRef: function (jompayRefId, jompayTransData, callback, issueId) {
        console.log("checkJompayRef ", jompayRefId)
        console.log("issueId is ", issueId)

        db.mysql.query(queries.checkJompayRefId, [jompayRefId], function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }
            if (results.length === 0) {
                // return callback(resGen.responseGenerator(resGen.NOT_FOUND, 'RefId not matched'));
                console.log("refId not matched")
                if (issueId) {
                    let status = "rejected"
                    let rejectionReason = "Jompay Reference Id not matched"
                    let approved_rejected_by_id = 0
                    let approved_rejected_at = moment().format("YYYY-MM-DD HH:mm:ss")
                    console.log("befor query called")
                    db.mysql.query(
                        queries.updateJompayInfo,
                        [null, status, rejectionReason, approved_rejected_by_id, approved_rejected_at, issueId],
                        function (err, results, fields) {
                            if (err) {
                                console.log("paymentSalesId err is ", err)
                                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                            }
                            if (results.affectedRows === 0) {
                                return callback(resGen.responseGenerator(resGen.NOT_FOUND, "Issue not found"))
                            }
                        }
                    )

                    return callback(resGen.responseGenerator(resGen.NOT_FOUND, "Reference Id not matched"))
                } else {
                    jompayTransData.setFlagReverse = true
                }
            }

            if (jompayTransData.setFlagReverse) {
                callback()
            } else {
                Object.assign(jompayTransData, results[0])

                const currentTime = moment(moment().format("YYYY-MM-DD HH:mm:ss"))
                const transCreationTime = moment(results[0].creation_date, "YYYY-MM-DD HH:mm:ss")
                const dayDiff = currentTime.diff(transCreationTime, "days")
                // const dayDiff = moment.duration(currentTime.diff(transCreationTime)).asDays();
                console.log("DayDiif is ", dayDiff)
                console.log("request validity is", cfg.jompayRefundRequestValidity)
                if (dayDiff > cfg.jompayRefundRequestValidity) {
                    //***it will be taken from the config
                    Object.assign(jompayTransData, { status: "rejected" })
                } else {
                    Object.assign(jompayTransData, { status: "pending" })
                }
                console.log("jompay trans data is ", jompayTransData)

                if (jompayTransData.paymentSalesId) {
                    console.log("duplicate request")
                    if (issueId) {
                        console.log("duplicate request from manual")

                        let status = "rejected"
                        let rejectionReason = "duplicate request"
                        let approved_rejected_by_id = 0
                        let approved_rejected_at = moment().format("YYYY-MM-DD HH:mm:ss")

                        db.mysql.query(
                            queries.updateJompayInfo,
                            [jompayTransData.paymentSalesId, status, rejectionReason, approved_rejected_by_id, approved_rejected_at, issueId],
                            function (err, results, fields) {
                                if (err) {
                                    console.log("paymentSalesId err is ", err)
                                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                                }
                                if (results.affectedRows === 0) {
                                    return callback(resGen.responseGenerator(resGen.NOT_FOUND, "Issue not found"))
                                }
                            }
                        )
                    }
                    return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, "can not proceed, request already submitted"))
                }

                callback()
            }
        })
    },

    requestJompayIssue: function (argu, flag, callback) {
        argu.salesOrderId = !flag ? null : argu.salesOrderId
        argu.status = !flag ? "not decided" : argu.status

        argu.approved_rejected_reason = flag && argu.status == "rejected" ? "Request rejected due to date expiration" : null

        argu.approved_rejected_at = flag && argu.status == "rejected" ? moment().format("YYYY-MM-DD HH:mm:ss") : null
        argu.approved_rejected_by_id = flag && argu.status == "rejected" ? 0 : null
        // console.log("rejected at ", argu.approved_rejected_at);
        console.log("argu is: ", argu)
        db.mysql.query(
            queries.createJompayRequest,
            [
                argu.actualTransferId,
                argu.salesOrderId,
                argu.issueReason,
                argu.approved_rejected_reason,
                argu.docUrl,
                argu.status,
                argu.approved_rejected_by_id,
                argu.approved_rejected_at,
                argu.userId,
                argu.userId,
                argu.issueFrom ? argu.issueFrom : null,
                argu.executionEnableAt ? argu.executionEnableAt : null
            ],
            function (err, results, fields) {
                if (err) {
                    console.log("err is ", err)
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                }
                if (results.length === 0) {
                    return callback(resGen.responseGenerator(resGen.NOT_FOUND, "RefId not matched"))
                }
                callback()
            }
        )
    },

    freezeBalanceByFundTransfer: function (jompayIssueInfo, callback) {
        const transferTo = 132493

        let data = {}
        let issueRequest = {
            transferType: 0,
            currencyId: 1,
            channel: "",
            amount: jompayIssueInfo.sales_order_total_amount,
            username: ""
        }

        issueRequest.transferTo = transferTo
        issueRequest.transferFrom = jompayIssueInfo.freezeUserId

        console.log("issueRequest is ", issueRequest)

        const fundTransferInfo = {
            [transferTo]: {
                id: transferTo,
                roleId: 1,
                currencyId: 1
            },
            [jompayIssueInfo.freezeUserId]: {
                id: jompayIssueInfo.freezeUserId,
                roleId: jompayIssueInfo.freezeUserRole,
                currencyId: jompayIssueInfo.freezeUserCurrency
            }
        }
        console.log("point transfer info is ", fundTransferInfo)

        // console.info("JompayIssue FundTransfer Info: ", fundTransferInfo);
        async.series(
            [
                callback => {
                    fundTransfer.executeFundTransferProcedure(false, fundTransferInfo, issueRequest, data, callback)
                },
                callback => {
                    console.log("data is ", data)
                    callback()
                }
            ],
            err => {
                if (err) return callback(err)
                return callback()
            }
        )
    },
    updateJompayInfo: function (argu, callback) {
        console.log("update argu is", argu)

        argu.approved_rejected_reason = argu.status == "rejected" ? "Request rejected due to date expiration" : null
        argu.approved_rejected_by_id = argu.status == "rejected" ? 0 : null
        argu.approved_rejected_at = argu.status == "rejected" ? moment().format("YYYY-MM-DD HH:mm:ss") : null

        db.mysql.query(
            queries.updateJompayInfo,
            [argu.salesOrderId, argu.status, argu.approved_rejected_reason, argu.approved_rejected_by_id, argu.approved_rejected_at, argu.issueId],
            function (err, results, fields) {
                if (err) {
                    console.log("err is ", err)
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
                }
                if (results.affectedRows === 0) {
                    return callback(resGen.responseGenerator(resGen.NOT_FOUND, "Issue not found"))
                }
                callback()
            }
        )
    },
    jompayIssueHistory: function (userId, resultIssues, callback) {
        db.mysql.query(queries.jompayHistory, [userId], function (err, results, fields) {
            if (err) {
                console.log("err is ", err)
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }
            if (results.length === 0) {
                return callback(resGen.responseGenerator(resGen.NOT_FOUND, "No history found"))
            }
            // resultIssues = JSON.parse(JSON.stringify(results));
            resultIssues.push(results)
            console.log("resultIssues is ", resultIssues)
            callback()
        })
    }
}
