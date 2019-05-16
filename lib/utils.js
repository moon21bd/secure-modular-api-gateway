'use strict';

const moment = require('moment');
const mt = require('moment-timezone');
const fs = require('fs');
const path = require('path');
const async = require('async');

const config = require('../config');

const MAX_RAND_NUM = 100;

module.exports = {
    executionType: {
        TOP_UP: 1,
        INTERNET: 2,
        SCRATCH_CARD: 3,
        PLATFORM_DIALER: 4,
        PLATFORM_CASH: 7,
        PLATFORM_PAYMENT: 14,
        RIA_MONEY: 15
    },
    generateLotNumber: function () {
        let rand = Math.floor(Math.random() * Math.floor(MAX_RAND_NUM)).toString().padStart(3, '0');
        let lotNumber = moment().format('YYYYMMDDSSS') + rand;
        return parseInt(lotNumber);
    },
    forEachAsync: function (arr, func, callback) {
        let processed = 0;
        if (arr.length === 0) return callback();

        arr.forEach((elem) => {
            func.apply(null, [elem]);
            ++processed;
            if (processed === arr.length) {
                return callback();
            }
        });
    },
    remove: function (src, dst, callback) {
        fs.rename(src, dst, callback);
    },
    deleteFilesFromDirectory: function (directory, timeout) {
        const callback = function (err) { };

        fs.readdir(directory, function (err, files) {
            let removedFiles = 0;
            async.eachSeries(files, function (file, callback) {
                fs.stat(path.join(directory, file), function (err, stat) {
                    if (err) {
                        return callback();
                    }

                    let threshold = Math.floor(Date.now() / 1000) - timeout;
                    if (threshold > Math.floor(stat.ctimeMs / 1000)) {
                        fs.unlink(path.join(directory, file), (err) => {
                            ++removedFiles;
                            return callback();
                        });
                    }
                });
            }, (err) => {
                config.logger.info('Total removed files from tmp/ directory: ' + removedFiles);
            });
        });
    },
    generateDynamicWhereCondition: function (columns, values, operators) {
        let whereCondition = 'WHERE';
        if (!operators) {
            operators = new Array(columns.length);
            for (let i = 0; i < operators.length; i++) operators[i] = '=';
        }

        let replacements = [];
        for (let index in columns) {
            let column = columns[index];
            let value = values[index];
            let operator = operators[index];

            if (value !== undefined) {
                whereCondition += ` ${column} ${operator} ? AND`;
                replacements.push(value);
            }
        }
        whereCondition += ' 1=1';

        return { whereCondition: whereCondition, replacements: replacements };
    },
    convertToJSON: function (content) {
        let jsonContent = {};

        content = !content ? '' : content;
        let pairs = content.split('&');
        for (let pairIndex in pairs) {
            let pair = pairs[pairIndex];
            let pairContent = pair.split('=');
            if (pairContent.length < 2) continue;

            jsonContent[pairContent[0]] = decodeURIComponent(pairContent[1]);
        }

        if (Object.keys(jsonContent).length === 0 && jsonContent.constructor === Object) {
            try {
                jsonContent = JSON.parse(content);
            } catch (e) { }
        }

        return jsonContent;
    },
    roundAmount: function (amount, ceil) {
        return (Math.trunc(amount * 100) + (!ceil ? 0 : 1)) / 100;
    },
    changeToUtcDate: function (dateToConvert, timezoneOfGivendate, isStartDate) {
        dateToConvert = dateToConvert || moment().format('YYYY-MM-DD');
        dateToConvert += isStartDate ? ' 00:00:00' : ' 23:59:59';

        return mt.tz(dateToConvert, timezoneOfGivendate).format('YYYY-MM-DD HH:mm:ss');
    },
    deleteFiles: function (paths, callback) {
        async.eachOfSeries(paths, function (item, key, callback) {
            fs.unlink(item, (err) => {
                // Log the error!
                return callback();
            });
        }, (err) => {
            // Log the error!
            return callback();
        });
    },
    isBetweenDateString: function (startDate, endDate) {
        if (!startDate || !endDate) return false;

        try {
            startDate = moment(startDate, 'YYYY-MM-DD HH:mm:ss');
            endDate = moment(endDate, 'YYYY-MM-DD HH:mm:ss');

            return moment().isBetween(startDate, endDate, 'seconds', '[]');
        } catch (e) {
            return false;
        }
    }
};
