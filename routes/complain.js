'use strict';

const express = require('express');
const async = require('async');
const moment = require('moment');
const crypto = require('crypto');
const base64 = require('base64url');
const common = require('../components/common');
const validator = require('../lib/validator');
const resGen = require('../lib/result.codes');
const resDet = require('../lib/result.details');
const cfg = require('../config');
const uuidv1    = require('uuid/v1');
const utils = require('../lib/utils');
const fs = require("fs");
const router = express.Router();
const path = require('path');
const process = require('process');
const complain = require('../components/complain');
let callback = common.callback;

const multer = require('multer');
// const tesseract = require("node-tesseract-ocr");
const tesseract = require("tesseract.js");

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        console.log("des is called");
        cb(null , 'public/images/jompay');
    },
    filename: (req, file, cb) => {
        console.log("file info ", file);
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

const upload = multer({ storage : storage, 
                        // limits: { fileSize: 1024*1024*5 }, 
                    }).single('file');

router.post('/jompay/payment-issue/raise', function(req, res){
    let data = {};
    let contentType = req.headers['content-type'];
    const config = {
        lang: "eng",
        oem: 1,
        psm: 3,
    };
    let image;
    let filePath;
    let fileName;
    let resultText = "";
    let refNumber;
    let jompayTransData = {};
    let sessionInfo = {};
    let flag = true;

    if (!contentType || contentType.indexOf('multipart/form-data') !== 0) {
        return res.status(400).json({
            "message": "invalid format, request must be form data"
        });
    }
    async.series([
        // callback => {
        //     let testUserId = req.body.userId;
        //     common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        // },
        callback => {
                upload(req, res, err => {
                    if(err){
                        console.log("jompay image upload error is ", err);
                        return callback(resGen.responseGenerator(resGen.INVALID_REQ_FORMAT_ERR, 'Something went wrong'));
                    }else{
                        callback();
                    }
                })
        },
        callback => {
            filePath = path.join(process.cwd(), req.file.path);
            fileName = req.file.filename;
            callback();
        },
        callback => {
                tesseract
                    .recognize(filePath,  'eng',
                    { logger: m => console.log(m) }
                    )
                    .then(({data: {text}}) => {
                        let resultArray = text.split("\n");

                        if(text.includes("JomPAY Reference Number ")){
                            console.log("resultArray1 is ", resultArray);
                            let jompayArr = resultArray.filter(item => item.includes('JomPAY Reference Number'));
                            console.log("jompayArray is ", jompayArr);
                            let jompayStr = jompayArr.shift();
                            let referenceNumArr = jompayStr.split(' ');
                            refNumber = referenceNumArr.pop();

                            // refNumber = imageExtract(resultArray, 'JomPAY Reference Number');
                        }else if(text.includes("Ref ")){
                            console.log("resultArray2 is ", resultArray);
                            let jompayArr = resultArray.filter(item => item.startsWith('Ref '));
                            console.log("jompayArray is ", jompayArr);
                            let jompayStr = jompayArr.shift();
                            let referenceNumArr = jompayStr.split(' ');
                            refNumber = referenceNumArr.pop();

                            // refNumber = imageExtract(resultArray, 'Ref ');
                        }else if(text.includes("JomPAY Reference No.\n")){
                            console.log("resultArray3 is ", resultArray);
                            let jompayArrIndex = resultArray.findIndex(item => item === 'JomPAY Reference No.');
                            console.log("jompayArray is ", jompayArrIndex);
                            refNumber = resultArray[jompayArrIndex+1];

                            // refNumber = imageExtractByIndex(resultArray, 'JomPAY Reference No.');
                        }else if(text.includes("JomPAY Reference Number\n")){
                            console.log("resultArray4 is ", resultArray);
                            resultArray = resultArray.filter(item => item != '');
                            console.log("resultArray4 is ", resultArray);
                            let jompayArrIndex = resultArray.findIndex(item => item === 'JomPAY Reference Number');
                            console.log("jompayArray is ", jompayArrIndex);
                            refNumber = resultArray[jompayArrIndex+1];
                        
                            // refNumber = imageExtractByIndex(resultArray, 'JomPAY Reference Number', true);
                        }else if(text.includes("JOMPAY MYR ")){
                            console.log("resultArray5");
                            resultArray = resultArray.filter(item => item != '');
                            console.log("resultArray5 is ", resultArray);
                            let jompayArrIndex = resultArray.findIndex(item => item.startsWith('JOMPAY MYR '));
                            console.log("jompayArray is ", jompayArrIndex);
                            refNumber = resultArray[jompayArrIndex+1];

                            // refNumber = imageExtractByIndex(resultArray, 'JOMPAY MYR ', true);
                        }
                        else if(text.includes("JomPAY Reference No. ")){
                            console.log("resultArray6 is ", resultArray);
                            let jompayArr = resultArray.filter(item => item.startsWith('JomPAY Reference No. '));
                            console.log("jompayArray is ", jompayArr);
                            let jompayStr = jompayArr.shift();
                            let referenceNumArr = jompayStr.split(' ');
                            refNumber = referenceNumArr.pop();

                            // refNumber = imageExtract(resultArray, 'JomPAY Reference No. ');
                        }
                        else{
                            console.log("no condition matched");
                            flag = false;
                        }
            
                        callback();
                    })
                    .catch((error) => {
                        console.log(
                          "Catch-Block-Image-Parsing-Error-Occured",
                          error
                        );
                        refNumber = "";
                        flag = false;
                        callback();
                        // callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, 'Image parsing error occured'));
                    })
        },
        callback => {
            if(flag){
                // refNumber = "891DP1UE";  
                console.log("ref number is ", refNumber);
                complain.checkJompayRef(refNumber, jompayTransData, callback);
            }else{
                callback();
            }
        },
        callback =>{
            console.log("ref number is ", refNumber);
            // return false;
            console.log("jompayTransData.setFlagReverse ", jompayTransData.setFlagReverse);
            if(jompayTransData.setFlagReverse){
                console.log("flag changed");
                flag = false;
                callback();
            }else{
                console.log("flag not changed");
                callback();
            }
        },
        callback => {
                if(flag){
                    if(jompayTransData.status != "rejected"){
                        if(jompayTransData.salesOrderUserId == 0 && jompayTransData.salesOrderStatusNote.includes("User not found")){
                            console.log("user is system");
                            callback();
                        }else{
                            console.log("user is not system");
                            if(jompayTransData.freezeUserId && jompayTransData.salesOrderUserId != 0 && jompayTransData.salesOrderStatusNote.includes("Success")){
                                complain.freezeBalanceByFundTransfer(jompayTransData, callback);
                            }else{
                                console.log("freeze user condition does not match");
                                callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, "Action not supported"));
                            }
                        }
                    }else{
                        callback();
                    }
                }else{
                    callback();
                }
        },
        callback => {
                jompayTransData.actualTransferId = req.body.actualTransferId;
                jompayTransData.issueReason = req.body.issueReason;
                jompayTransData.userId = req.body.userId;
                let imagePath = `images/jompay/${fileName}`;
                jompayTransData.docUrl = imagePath;

                if(flag && jompayTransData.status == 'rejected'){
                    complain.requestJompayIssue(jompayTransData, flag, (err) => {
                        if (err) {
                            return callback(err);
                        }

                        return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, 'Your request is rejected due to date expiration'));
                    });
                }else{
                    complain.requestJompayIssue(jompayTransData, flag, callback);
                }
                
        }
    ], err => {
        if (err) {
            console.log("err is ", err);
            return callback(err, req, res, null);
        }
        else{
            data="successfully requested";
            callback(null, req, res, data);
        }

    })

});



// const imageExtract = (resultArray, itemMatch) =>{
//     let jompayArr = resultArray.filter(item => item.startsWith(itemMatch));
//     console.log("jompayArray is ", jompayArr);
//     let jompayStr = jompayArr.shift();
//     let referenceNumArr = jompayStr.split(' ');
//     return referenceNumArr.pop();
// }

// const imageExtractByIndex = (resultArray, matchItem, filterSpace = undefined) => {
//     if(filterSpace){
//         resultArray = resultArray.filter(item => item != '');
//     }
//     console.log("after remove resultArray is ", resultArray);
//     let jompayArrIndex = resultArray.findIndex(item => item === matchItem);
//     console.log("jompayArray index plus 1 is", resultArray[jompayArrIndex+1]);

//     return resultArray[jompayArrIndex+1];
// }

module.exports = router;