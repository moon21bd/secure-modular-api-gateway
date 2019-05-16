'use strict';

const async = require('async');
const crypto = require('crypto');
const moment = require('moment');
const request = require('request');

const queries = require('./queries');
const db = require('../../resources/database.connection');
const resGen = require('../../lib/result.codes');
const resDet = require('../../lib/result.details');
const common = require('../../components/common');
const product = require('../../components/product');
const order = require('../../components/order');
const fundTransfer = require('../../components/fund_transfer');
const role = require('../../components/role');
const routes = require('../../components/routes');
const cfg = require('../../config');

module.exports={
	formateRowDataPacket: function (data) {
		return JSON.parse(JSON.stringify(data));
	},
	getUserData: function (arug, userData, callback) {
		let parent = this;
		let arugData = [];
		let sqlQuery = "";
		if (arug.migrateType == "manual") {
			arugData = [
				arug.authUserId
			];
			sqlQuery = queries.checkUserMerchantEligibilityManually;
		} else {
			arugData = [
				arug.authUserId,
				arug.transactionAmount,
				arug.transactionAmount,
				arug.transactionAmount
			];
			sqlQuery = queries.checkUserMerchantEligibility;
		}
		db.mysql.query(sqlQuery, arugData,
			function (err, results) {
				if (err) {
					return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
				}

				if (results.length === 0) {
					return callback(resGen.responseGenerator(resGen.NOT_FOUND, "User not found", resDet.NO_USER_FOUND));
				}

				let resultData = parent.formateRowDataPacket(results);

				Object.assign(userData, resultData[0]);
				callback();
			});

	},
	executeMigrateUserToMerchant: function (arug, callback) {
		let data = [
			arug.depositAmount,
			arug.migrateRoleId,
			arug.authUserId
		];
		db.mysql.query(queries.migrateUserToMerchant, data,
			function (err, results) {
				if (err) {
					return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
				}
				if(results.affectedRows == 0){
					results.message = "This user has been already referred.";
					return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, results));
				}
				callback();
			});

	},
	migrateUserRole: function (arug, callback) {
		const {
			userId,
			transactionAmount
		} = arug;
		let userData = {};
		let productInfo = {};
		let executionResponse = {};

		async.series([
			callback => {
				let data = {
					authUserId: arug.userId,
					transactionAmount: arug.transactionAmount,
					migrateType: arug.migrateType
				};
				this.getUserData(data, userData, callback);
			},
			callback => {
				console.log("getUserData", userData);
				product.retrieveProductInformationUsingId(userData.merchant_sd_product_id, productInfo, callback);
			},
			callback => {
				let executionRequest = {
					transactionType: 'TRANSACTION',
					executionConfigId: productInfo.executionConfigId,
					productId: productInfo.productId,
					currencyId: -1,
					amount: productInfo.productValue,
					mobileNo: 'NA',
					operator: 'NA',
					channel: 'NA',
					userId: userId,
					additionalData: {
						executionType: 8,
						requestedBy: userData.user_name,
						walletTypeId: -1
					}
				};
				order.requestToExecutionEngine(executionRequest, executionResponse, callback);
			},
			callback => {
				if (executionResponse.code != 200) {
					return callback(executionResponse);
				}
				let data = {
					depositAmount: productInfo.productValue,
					migrateRoleId: userData.limit_to_role,
					authUserId: userId
				};
				this.executeMigrateUserToMerchant(data, callback);
			},
			callback => {
				console.log("executeMigrateUserToMerchant");
				let data = {
					amount: productInfo.productValue,
					productId: userData.merchant_sd_product_id,
					userId: userData.user_id,
					referredBy: userData.referred_by,
					roleId: userData.referred_by_role,
					toRoleId: 8
				}
				fundTransfer.migrateRoleReferralCommission(data, callback);
			}
		], err => {
			if (err) {
				err.errorType = "migrateUserRole";
				console.log("migrateUserRole err: ", err);
				console.log('data (error block) ', userData)
				return callback(err);
			}
			console.log('data', userData)
			callback(null, userData)

		})
	},
	getMigratedRoleUser: function (arug, userData, callback) {
		let parent = this;
		db.mysql.query(queries.getMigratedRoleUser, [arug.authUserId],
			function (err, results) {
				if (err) {
					return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
				}

				if (results.length === 0) {
					return callback(resGen.responseGenerator(resGen.NOT_FOUND, undefined, resDet.NO_USER_FOUND));
				}

				let resultData = parent.formateRowDataPacket(results);

				Object.assign(userData, resultData[0]);
				callback();
			});

	},
	makeSecurityDeposit: function (arug, callback) {
		const {
			userId
		} = arug;
		let userData = {};
		let productInfo = {};
		let executionResponse = {};

		async.series([
			callback => {
				let data = {
					authUserId: userId
				};
				this.getMigratedRoleUser(data, userData, callback);
			},
			callback => {
				product.retrieveProductInformationUsingId(userData.merchant_sd_product_id, productInfo, callback);
			},
			callback => {
				let executionRequest = {
					transactionType: 'TRANSACTION', //cfg.giftSignup.transferType,
					executionConfigId: productInfo.executionConfigId,
					productId: productInfo.productId,
					currencyId: -1,
					amount: productInfo.productValue,
					mobileNo: 'NA',
					operator: 'NA',
					channel: 'NA',
					userId: userId,
					additionalData: {
						executionType: 1,
						requestedBy: userData.user_name,
						walletTypeId: -1
					}
				};
				order.requestToExecutionEngine(executionRequest, executionResponse, callback);
			},
			callback => {
				let data = {
					depositAmount: productInfo.productValue,
					migrateRoleId: 8, //userData.limit_to_role,
					authUserId: userId
				};
				this.executeMigrateUserToMerchant(data, callback);
			}
		], err => {
			return callback(null, userData);
		})
	},
};
