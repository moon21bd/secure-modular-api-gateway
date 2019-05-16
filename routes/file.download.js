'use strict';

const express          = require('express');
const async            = require('async');
const archiver         = require('archiver');
const fs               = require('fs');
const moment           = require('moment');
const excel            = require('exceljs');
const base64Url        = require('base64url');

const resGen           = require('../lib/result.codes');
const db               = require('../resources/database.connection');
const th               = require('../lib/tokenhandler');
const validator        = require('../lib/validator');
const utils            = require('../lib/utils');

const common           = require('../components/common');
const reports          = require('../components/reports');
const cfg              = require('../config');

const callback = common.callback;

const router = express.Router();

router.get('/download/deposit-slips/:searchParams', function (req, res) {
    let searchParams = {};

    let localCallback = (err) => {
        if (err) {
            callback(err, req, res);
        }
    };

    async.series([
        localCallback => {
            getSearchParamsForDepositSlips(req.params.searchParams, searchParams, localCallback);
        },
        localCallback => {
            common.verifySession(searchParams.userId, searchParams.sessionId, localCallback, undefined, req.headers.referer);
        },
        localCallback => {
            streamDepositSlips(searchParams, res, localCallback);
        }
    ], err => {
        if (err) {
            return localCallback(err);
        }

        return localCallback();
    });
});

router.get('/reports/generate', function(req, res, next) {
    req.originalUrl = '/api/reports/generate';
    if (cfg.env === 'development') {
        try {
            req.body = JSON.parse(base64Url.decode(req.query.payload));
        } catch (e) {
            return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, 'Payload is not JSON formatted'), req, res);
        }

        return next();
    }

    req.body = {
        payload: req.query.payload
    };
    th.retrievePayload(req, res, next);
}, validator, function (req, res) {
    let reportGenerator = 'CALL platform_report_generator(?, ?, ?, ?, ?, ?, ?)';

    req.body.startDate = utils.changeToUtcDate(req.body.startDate, req.body.timezone, true);
    req.body.endDate = utils.changeToUtcDate(req.body.endDate, req.body.timezone);
    let filters = req.body.additionalFilters || {};
    filters.offset = req.query.start;
    filters.size = req.query.length;

    let serializedFilters = Object.keys(filters).map(k => k + ':' + filters[k]).join('|');

    let replacements = [ req.body.type, req.body.userId, req.body.sessionId, req.body.reportedUserId, req.body.startDate, req.body.endDate, serializedFilters ];
    common.verifySession(req.body.userId, req.body.sessionId, (err) => {
        if (err) {
            res.json(resGen.finalizeResponse(err));
            return;
        }

        let response = {};
        reports.reportQueryExecutionUsingPagination(reportGenerator, replacements, response, (err) => {
            res.json({
                draw: req.query.draw,
                recordsTotal: response.data[0].totalFiltered,
                recordsFiltered: response.data[0].totalFiltered,
                data: response.data[0].values
            })
        });
    }, undefined, req.headers.referer);
});

router.get('/reports/download', function(req, res, next) {
        req.originalUrl = '/api/reports/download';
        if (cfg.env === 'development') {
            try {
                req.body = JSON.parse(base64Url.decode(req.query.payload));
            } catch (e) {
                return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, 'Payload is not JSON formatted'), req, res);
            }

            return next();
        }

        req.body = {
            payload: req.query.payload
        };
        th.retrievePayload(req, res, next);
    }, validator, function (req, res) {
        let reportGenerator = 'CALL platform_report_generator(?, ?, ?, ?, ?, ?, ?)';

        req.body.startDate = utils.changeToUtcDate(req.body.startDate, req.body.timezone, true);
        req.body.endDate = utils.changeToUtcDate(req.body.endDate, req.body.timezone);
        let filters = req.body.additionalFilters || {};

        delete filters['cursor'];
        delete filters['size'];

        let serializedFilters = Object.keys(filters).map(k => k + ':' + filters[k]).join('|');
        let replacements = [req.body.type, req.body.userId, req.body.sessionId, req.body.reportedUserId, req.body.startDate, req.body.endDate, serializedFilters];

        common.verifySession(req.body.userId, req.body.sessionId, (err) => {
            if (err) {
                return callback(err, req, res);
            }

            db.mysql.getConnection((err, connection) => {
                if (err) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err), req, res);
                }

                streamReportContents(connection, reportGenerator, replacements, req, res);
            });
        }, undefined, req.headers.referer);
    }
);

function streamReportContents(connection, reportGenerator, replacements, req, res) {
    let error = false;
    let process = connection.query(reportGenerator, replacements);
    let excludes = req.body.excludes || [];
    let headers = [];

    let workbook = new excel.stream.xlsx.WorkbookWriter({stream: res});
    let worksheet = workbook.addWorksheet(req.body.name);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader("Content-Disposition", "attachment; filename=" + req.body.name + '.' + req.body.fileType);

    let maxProcessing = 100;
    let timeoutFn;
    process
        .on('error', function (err) {
            connection.release();
            error = true;
            cfg.logger.error(err);
        })
        .on('fields', function (fields) {
            if (!(fields instanceof Array)) return;

            headers = fields.filter((v, k) => ! excludes.includes(k)).map((v) => v['name']);
            worksheet.columns = headers.map((field) => { return { header: field.replace(/_/g, ' ') } });
        })
        .on('result', function (row) {
            if (row.affectedRows !== undefined) return;

            let rowData = [];
            for (let index in headers) {
                rowData.push(row[headers[index]]);
            }
            worksheet.addRow(rowData).commit();

            maxProcessing = maxProcessing - 1;
            if (maxProcessing === 0) {
                connection.pause();
                if (timeoutFn) clearTimeout(timeoutFn);

                timeoutFn = setTimeout(() => {
                    maxProcessing = 100;
                    connection.resume();
                }, 10);
            }
        })
        .on('end', function () {
            connection.release();

            if (!error) {
                worksheet.commit();

                workbook
                    .commit()
                    .then(() => {
                        res.end();
                    })
                    .catch((err) => {
                        cfg.logger.error(err);
                    });
            }
        });
}

function getSearchParamsForDepositSlips(encryptedSearchParams, searchParams, callback) {
    let query = `SELECT platform_search_params_encryption(?, 0) AS searchParams`;
    db.mysql.query(query, [encryptedSearchParams], function (err, results, fields) {
        if (err) {
            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
        }

        let parts = results[0].searchParams.split('|');
        if (parts.length < 6) {
            return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR));
        }

        searchParams.userId = parts[0];
        searchParams.sessionId = parts[1];
        searchParams.userType = parts[2];
        searchParams.searchedUserId = parts[3];
        searchParams.isMonthInterval = parts[4] === '1';
        searchParams.depositDate = parts[5];

        callback();
    });
}

function streamDepositSlips(searchParams, res, callback) {
    let archiveDirectory = cfg.fileRootDirectory;
    let depositDate = searchParams.depositDate;
    if (searchParams.isMonthInterval && searchParams.depositDate) {
        depositDate = searchParams.depositDate.substr(3);
    }

    let archiveFileName = `deposit_slip_${depositDate}.zip`;

    let interval = getDateInterval(searchParams.depositDate, searchParams.isMonthInterval);

    let archive = archiver('zip');

    archive.on('error', function(err) {
        return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
    });

    //set the archive name
    res.attachment(archiveFileName);

    archive.pipe(res);

    let query = `
        SELECT so.sales_order_user_id AS salesUserId, so.sales_order_deposit_slip AS depositSlip
        FROM platform_sales_order AS so
        JOIN platform_users AS u ON so.sales_order_user_id = u.user_id 
        WHERE so.sales_order_type != 2 AND so.sales_order_status = 1
            AND (so.sales_order_user_id = ? OR ? = 0)
            AND (
                (? = 0 AND u.user_id = ?) OR
                (? = 1 AND u.user_parent_id = ?) OR
                (? = 2 AND u.user_contact_id = ?) OR
                (? = 3)
            )
            AND so.sales_order_deposit_slip IS NOT NULL
            AND so.creation_date >= ? 
            AND so.creation_date < ?
    `;
    let replacements = [
        searchParams.searchedUserId, searchParams.searchedUserId, searchParams.userType, searchParams.userId,
        searchParams.userType, searchParams.userId, searchParams.userType, searchParams.userId,
        searchParams.userType, interval.startDate, interval.endDate
    ];

    db.mysql.query(query, replacements, function (err, results, fields) {
        if (err) {
            return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
        }

        for (let index in results) {
            let salesUserId = results[index].salesUserId;
            let filePath = results[index].depositSlip;
            let filename = results[index].depositSlip.split('/').pop();
            let archiveFilename = salesUserId + '_' + searchParams.depositDate + '_' + filename;
            archive.append(fs.createReadStream(archiveDirectory + filePath), { name: archiveFilename });
        }

        archive.finalize();
        callback();
    });
}

function getDateInterval(givenDate, isMonthInterval) {
    let date = moment(givenDate);
    let intervalType = isMonthInterval ? 'month' : 'day';

    return {
        startDate: moment(date.startOf(intervalType).format('DD-MMM-YY HH:mm:ss')).format('YYYY-MM-DD HH:mm:ss'),
        endDate: moment(date.endOf(intervalType).format('DD-MMM-YY HH:mm:ss')).format('YYYY-MM-DD HH:mm:ss')
    };
}

module.exports = router;
