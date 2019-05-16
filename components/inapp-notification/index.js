"use strict"

const queries = require("./queries")
const db = require("../../resources/inapp-notification.database.connection")
const cbsDb = require("../../resources/database.connection")
const resGen = require("../../lib/result.codes")

module.exports = {
    buildTemplate: (payload, callback) => {
        //? [notification_type_id, title, template, deep_link, image_url, is_primary, status]
        const template = [1, payload.data.title, payload.data.body, payload.data.deepLink, payload.data.icon, 1, 1]
        db.mysql.query(queries.createNotificationTemplate, template, function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            Object.assign(payload, { template_id: results.insertId })
            return callback()
        })
    },

    createNotificationEntries: (payload, callback) => {
        let bulkData = []
        payload.recipients.forEach(x => bulkData.push([payload.template_id, x, payload.from]))

        db.mysql.query(queries.createNotifications, [bulkData], (err, results, fields) => {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            return callback()
        })
    },

    getNotifications: (payload, container, callback) => {
        db.mysql.query(queries.getNotifications(payload.limit), [payload.userId], (err, results, fields) => {
            if (err) {
                // console.error("Get app-notifications error: ", err)
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            container.push(...results)
            return callback()
        })
    },
    updateNotificationCount: (payload, callback) => {
        cbsDb.mysql.query(queries.updateNotificationCount, [[payload]], (err, results, fields) => {
            if (err) {
                // console.error("update notification-count error: ", err)
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))
            }

            return callback()
        })
    },

    getNotificationCount: (userId, response, callback) => {
        cbsDb.mysql.query(queries.getNotificationCount, [userId], (err, results, fields) => {
            if (err || results.length === 0) return callback(JSON.stringify(response))

            Object.assign(response, results[0])

            return callback(JSON.stringify(response))
        })
    },

    clearNotificationCount: (userId, callback) => {
        cbsDb.mysql.query(queries.clearNotificationCount, [userId], (err, results, fields) => {
            if (err) return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err))

            return callback()
        })
    }
}
