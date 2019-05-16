'use strict';

const express   = require('express');
const async     = require('async');
const multer    = require('multer');
const uuidv1    = require('uuid/v1');
const jimp      = require('jimp');
const fs        = require('fs');

const resGen    = require('../lib/result.codes');
const common    = require('../components/common');
const db        = require('../resources/database.connection');
const queries   = require('../resources/database.queries');
const utils     = require('../lib/utils');
const cfg       = require('../config');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'tmp/');
    },
    filename: (req, file, cb) => {
        file.id = uuidv1().replace(/-/g, '');
        let fileNameParts = file.originalname.split('.');
        let extension = fileNameParts.length === 1 ? '' : '.' + fileNameParts.pop();
        if (!cfg.supportedFileExtensions.some((ext) => (extension.toLowerCase()) === '.' + ext)) {
            return cb(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR));
        }

        file.extension = extension;
        let filename = file.id + extension;
        cb(null, filename);
    }
});

const upload = multer({ storage: storage }).any();

const router = express.Router();

function saveFileMetaData(filesInfo, metaInfo, callback) {
    async.eachOfSeries(filesInfo, function(item, key, callback) {
        db.redis.set(queries.keyForContentInfo(item.id), JSON.stringify({path: item.path, extension: item.extension}), 'EX', cfg.ttl.tmpfile,
            function (err, reply) {
                if (err) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                }

                if (!reply) {
                    return callback(resGen.responseGenerator(resGen.NOT_FOUND, 'Content is not found for content id [' + item.contentId + ']'))
                }

                metaInfo.push({contentId: item.id, filename: item.originalname});
                return callback()
            }
        );
    }, err => {
        if (err) {
            return callback(err);
        }

        return callback();
    });
}

function checkImageFileData(filesInfo, callback) {
    let hasAnyCorruptImage = false;

    async.eachOfSeries(filesInfo, function(item, key, callback) {
        let imageFile;
        let corruptImage = false;

        async.series([
            callback => {
                jimp.read(item.path, (err, file) => {
                    if (err) {
                        corruptImage = true;
                    }

                    if (!corruptImage) {
                        imageFile = file;
                    }

                    return callback();
                });
            },
            callback => {
                if (corruptImage) return callback();

                let orgWidth = imageFile.bitmap.width;
                let orgHeight = imageFile.bitmap.height;

                imageFile
                    .resize(orgWidth - 1, orgHeight - 1)
                    .resize(orgWidth, orgHeight)
                    .write(item.path, (err) => {
                        return callback();
                    });
            }
        ], err => {
            if (corruptImage && !hasAnyCorruptImage) {
                hasAnyCorruptImage = true;
            }

            if (err || corruptImage) {
                return fs.unlink(item.path, (err) => {
                    return callback();
                });
            }
            return callback();
        });
    }, err => {
        if (err) {
            return callback(err);
        }

        if (hasAnyCorruptImage) {
            return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, 'Corrupt image file'));
        }

        return callback();
    });
}

router.post('/file-upload', function(req, res) {
    let contentType = req.headers['content-type'];

    if (!contentType || contentType.indexOf('multipart/form-data') !== 0) {
        return common.callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR), req, res);
    }

    upload(req, res, function(err) {
        if (err) {
            return common.callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, 'File extension does not supported'), req, res);
        }

        if (!req.files) {
            return common.callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, 'No file is given'), req, res);
        }

        let metaInfo = [];
        checkImageFileData(req.files, (err) => {
            if (err) {
                return common.callback(err, req, res);
            }

            saveFileMetaData(req.files, metaInfo, (err) => {
                if (err) {
                    return common.callback(err, req, res);
                }

                if (metaInfo.length === 0) {
                    return common.callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR, 'No file is given'), req, res);
                }

                return common.callback(null, req, res, metaInfo);
            });
        });
    });
});

module.exports = router;