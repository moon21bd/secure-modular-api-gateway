'use strict';

const express    = require('express');
const async      = require('async');

const common     = require('../components/common');
const product    = require('../components/product');
const role       = require('../components/role');
const currency   = require('../components/currency');
const user       = require('../components/user');
const reports    = require('../components/reports');
const rolePermission = require('../lib/role.permission');

const utils      = require('../lib/utils');

const resGen     = require('../lib/result.codes');
const config     = require('../config');

const router = express.Router();

let callback = common.callback;

router.post('/product-category/show', function(req, res) {
    let data = [];
    let sessionInfo = {};

    async.series([
        callback => {
            common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        },
        callback => {
            product.retrieveProductCategoryInfo(req.body.productCategoryId, data, callback);
        }
    ], err => {
        if (err) {
            return callback(err, req, res);
        }

        callback(null, req, res, data, true);
    })
});

router.post('/product/create', function (req, res) {
    let sessionInfo = {};
    let contents = [];
    let container = {};
    let data = {};

    let input = {
        productName: req.body.productName,
        productDescription: req.body.productDescription,
        productCategoryId: req.body.productCategoryId,
        productValue: req.body.productValue || 0,
        productCurrencyId: req.body.productCurrencyId,
        productSalesValue: req.body.productSalesValue || 0,
        isComissionApplicable: req.body.isComissionApplicable || 0,
        isDiscountApplicable: req.body.isDiscountApplicable || 0,
        hasVariableAmount: req.body.hasVariableAmount || 0,
        productMinimumValue: req.body.productMinimumValue || 0,
        productMaximumValue: req.body.productMaximumValue || 0,
        probableAmounts: req.body.probableAmounts ? req.body.probableAmounts.join('|') : req.body.probableAmounts,
        reference1: req.body.reference1,
        reference2: req.body.reference2,
        reference3: req.body.reference3,
        reference4: req.body.reference4,
        reference5: req.body.reference5,
        reference6: req.body.reference6,
        reference7: req.body.reference7
    };

    async.series([
        callback => {
            checkForProductCreationValues(input, callback);
        },
        callback => {
            common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        },
        callback => {
            let executionConfig = config.categoryWiseExecutionConfig[req.body.productCategoryId];
            if (!executionConfig) return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, `No execution configuration id found for product category id [${req.body.productCategoryId}]`));

            input.executionConfigId = executionConfig.executionConfigId;
            callback();
        },
        callback => {
            currency.verifyCurrencyId(input.productCurrencyId, callback);
        },
        callback => {
            input.createdBy = sessionInfo['username'];
            common.getContentsInformation(req.body.resources, contents, callback);
        },
        callback => {
            common.moveContents(req.body.userId, contents, callback);
        },
        callback => {
            common.setResourcesFields(input, contents, callback);
        },
        callback => {
            product.createProductInformation(input, container, callback);
        },
        callback => {
            product.retrieveProductInformationUsingId(container.productId, data, callback);
        },
    ], err => {
        if (err) {
            return callback(err, req, res);
        }

        callback(null, req, res, data);
    })
});

router.post('/product/update', function(req, res) {
    let sessionInfo = {};
    let contents = [];

    let updatedData = {
        productId: req.body.productId,
        productName: req.body.productName,
        productDescription: req.body.productDescription,
        productStatus: req.body.productStatus,
        productCategoryId: req.body.productCategoryId,
        productExecutionConfigId: req.body.productExecutionConfigId,
        productValue: req.body.productValue,
        productCurrencyId: req.body.productCurrencyId,
        productSalesValue: req.body.productSalesValue,
        isComissionApplicable: req.body.isComissionApplicable,
        isDiscountApplicable: req.body.isDiscountApplicable,
        hasVariableAmount: req.body.hasVariableAmount,
        productMinimumValue: req.body.productMinimumValue,
        productMaximumValue: req.body.productMaximumValue,
        probableAmounts: req.body.probableAmounts ? req.body.probableAmounts.join('|') : req.body.probableAmounts,
        reference1: req.body.reference1,
        reference2: req.body.reference2,
        reference3: req.body.reference3,
        reference4: req.body.reference4,
        reference5: req.body.reference5,
        reference6: req.body.reference6,
        reference7: req.body.reference7,
        updatedBy: sessionInfo['username']
    };

    async.series([
        callback => {
            common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        },
        callback => {
            if (!updatedData.productCurrencyId) return callback();
            currency.verifyCurrencyId(updatedData.productCurrencyId, callback);
        },
        callback => {
            if (!req.body.resources) return callback();
            common.getContentsInformation(req.body.resources, contents, callback);
        },
        callback => {
            if (!req.body.resources) return callback();
            common.moveContents(req.body.userId, contents, callback);
        },
        callback => {
            if (!req.body.resources) return callback();
            common.setResourcesFields(updatedData, contents, callback);
        },
        callback => {
            updatedData.updatedBy = sessionInfo['username'];
            product.updateProductInformation(updatedData, callback);
        }
    ], err => {
        if (err) {
            return callback(err, req, res);
        }

        callback(null, req, res);
    })
});

router.post('/product/show', function(req, res) {
    let data = [];
    let userInfo = [];
    let sessionInfo = {};

    req.body.filters.needCommissionCalculation = req.body.addCommission === 'yes';
    async.series([
        callback => {
            common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        },
        callback => {
            if (!req.body.filters.needCommissionCalculation) return callback();
            user.fetchSpecificUserInfo(req.body.userId, userInfo, callback);
        },
        callback => {
            if (!req.body.filters.needCommissionCalculation) return callback();
            req.body.filters.roleId = userInfo[0].roleId;
            return callback();
        },
        callback => {
            product.retrieveProductInformationInUserCurrency(req.body.filters,req.body.userId, data, callback);
        }
    ], err => {
        if (err) {
            return callback(err, req, res);
        }

        callback(null, req, res, data, true);
    })
});

router.post('/product/show/all', function(req, res) {
    let data = [];
    let sessionInfo = {};

    async.series([
        callback => {
            common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        },
        callback => {
            product.retrieveAllProductInformation(req.body.filters, data, callback);
        }
    ], err => {
        if (err) {
            return callback(err, req, res);
        }

        callback(null, req, res, data, true);
    })
});

router.post('/product-rates/create', function(req, res) {
    let data = [];
    let sessionInfo = {};
    let container = {};

    if (req.body.rateType) {
        req.body.rateType = req.body.rateType === 'commission' ? 'comission' : req.body.rateType;
    }

    let request = Object.assign({ rateType: 'comission', priority: 0, rateApplicableType: 1 }, req.body);

    async.series([
        callback => {
            common.verifySession(request.userId, request.sessionId, callback, sessionInfo, req.headers.referer);
        },
        callback => {
            let authorized = rolePermission.checkRolePermission(
                sessionInfo.rolePermissions, {
                    resource: 'platform_product_rates',
                    actionType: rolePermission.actionType.INSERT,
                    attributes: [
                        {
                            name: 'rate_productid',
                            value: request.productId
                        }
                    ]
                });
            if (!authorized) {
                return callback(resGen.responseGenerator(resGen.AUTH_TOKEN_ERR, 'You do not have sufficient permission'));
            }

            return callback();
        },
        callback => {
            product.verifyProductId(request.productId, callback);
        },
        callback => {
            if (!request.roleId) return callback();

            role.checkIfRoleIdExists(request.roleId, {}, callback);
        },
        callback => {
            if (!request.appliedUserId) return callback();

            user.checkIfUserExists(request.appliedUserId, callback);
        },
        callback => {
            let input = {
                rateType: request.rateType,
                productId: request.productId,
                roleId: request.roleId,
                appliedUserId: request.appliedUserId,
                priority: request.priority,
                rateApplicableType: request.rateApplicableType,
                rateAmount: request.rateAmount,
                createdBy: sessionInfo['username']
            };

            product.createProductRates(input, container, callback);
        },
        callback => {
            product.fetchProductRates({rateId: container.rateId}, data, callback);
        }
    ], err => {
        if (err) {
            return callback(err, req, res);
        }

        callback(null, req, res, data);
    })
});

router.post('/product-rates/update', function(req, res) {
    let sessionInfo = {};
    let rateInfo = [];

    let updatedRequest = Object.assign({}, req.body.updatedFields);
    updatedRequest.roleId && (updatedRequest.roleId = Number(updatedRequest.roleId));
    updatedRequest.appliedUserId && (updatedRequest.appliedUserId = Number(updatedRequest.appliedUserId));

    async.series([
        callback => {
            common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        },
        callback => {
            product.fetchProductRates({rateId: req.body.productRatesId}, rateInfo, callback);
        },
        callback => {
            rateInfo = rateInfo[0];
            let authorized = rolePermission.checkRolePermission(
                sessionInfo.rolePermissions, {
                    resource: 'platform_product_rates',
                    actionType: rolePermission.actionType.UPDATE,
                    attributes: [
                        {
                            name: 'rate_productid',
                            value: rateInfo.productId
                        }
                    ]
                });
            if (!authorized) {
                return callback(resGen.responseGenerator(resGen.AUTH_TOKEN_ERR, 'You do not have sufficient permission'));
            }

            return callback();
        },
        callback => {
            if (!updatedRequest.productId) return callback();

            product.verifyProductId(updatedRequest.productId, callback);
        },
        callback => {
            if (!updatedRequest.roleId) return callback();

            role.checkIfRoleIdExists(updatedRequest.roleId, {}, callback);
        },
        callback => {
            if (!updatedRequest.appliedUserId) return callback();

            user.checkIfUserExists(updatedRequest.appliedUserId, callback);
        },
        callback => {
            if (updatedRequest.rateType) {
                updatedRequest.rateType = updatedRequest.rateType === 'commission' ? 'comission' : updatedRequest.rateType;
            }

            let updatedFields = {
                productRatesId: req.body.productRatesId,
                rateType: updatedRequest.rateType,
                productId: updatedRequest.productId,
                roleId: updatedRequest.roleId,
                appliedUserId: updatedRequest.appliedUserId,
                priority: updatedRequest.priority,
                rateApplicableType: updatedRequest.rateApplicableType,
                status: updatedRequest.status,
                rateAmount: updatedRequest.rateAmount,
                updatedBy: sessionInfo['username']
            };
            product.updateProductRates(updatedFields, callback);
        }
    ], err => {
        if (err) {
            return callback(err, req, res);
        }

        callback(null, req, res);
    })
});

router.post('/product-rates/show', function(req, res) {
    let data = [];
    let sessionInfo = {};

    async.series([
        callback => {
            common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        },
        callback => {
            let filters = {
                rateId: req.body.filters.productRatesId,
                productId: req.body.filters.productId,
                roleId: req.body.filters.roleId,
                categoryId: req.body.filters.categoryId
            };

            product.fetchProductRates(filters, data, callback);
        }
    ], err => {
        if (err) {
            return callback(err, req, res);
        }

        callback(null, req, res, data);
    })
});

router.post('/package/create', function (req, res) {
    let sessionInfo = {};

    let input = {
        packageName: req.body.packageName,
        packageDescription: req.body.packageDescription,
        groupName: req.body.groupName,
        isViewable: (req.body.isViewable !== undefined) ? req.body.isViewable : 1,
        packageSalesValue: req.body.packageSalesValue,
        productList: req.body.productList || []
    };

    async.series([
        callback => {
            common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        },
        callback => {
            input.createdBy = sessionInfo['username'];
            product.createPackage(input, callback);
        }
    ], err => {
        if (err) {
            return callback(err, req, res);
        }

        callback(null, req, res);
    })
});

router.post('/package/update', function (req, res) {
    let sessionInfo = {};

    let updatedFields = {
        packageId: req.body.packageId,
        packageName: req.body.packageName,
        packageUpdateNeeded: (
            req.body.packageName !== undefined
            || req.body.packageDescription !== undefined
            || req.body.status !== undefined
            || req.body.packageSalesValue !== undefined
            || req.body.groupName !== undefined
            || req.body.isViewable !== undefined
        ),
        groupName: req.body.groupName,
        isViewable: req.body.isViewable,
        status: req.body.status,
        packageSalesValue: req.body.packageSalesValue,
        productList: classifyPackageProducts(req.body.productList)
    };

    async.series([
        callback => {
            common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        },
        callback => {
            updatedFields.updatedBy = sessionInfo['username'];
            product.updatePackage(updatedFields, callback);
        }
    ], err => {
        if (err) {
            return callback(err, req, res);
        }

        callback(null, req, res);
    })
});

router.post('/package/show', function(req, res) {
    let data = [];
    let sessionInfo = {};

    async.series([
        callback => {
            common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        },
        callback => {
			if (req.body.filters.withDetails) return callback();

            if (req.body.filters.packageId) return callback();
            product.retrievePackages(data, callback);
        },
        callback => {
            if (req.body.filters.withDetails) return callback();

            if (!req.body.filters.packageId) return callback();
            product.retrievePackageUsingId(req.body.filters.packageId, (err, result) => {
                if (err) {
                    return callback(err);
                }

                data.push(result);
                return callback();
            });
        },
        callback => {
            if (req.body.filters.withDetails) return callback();

            for (let index in data) {
                let packageInfo = data[index];
                let products = packageInfo.productList;
                packageInfo.productList = [];

                if (products) {
                    let serializedProductInfo = products.split('$');
                    for (let productIndex in serializedProductInfo) {
                        let productInfoParts = serializedProductInfo[productIndex].split('|');
                        if (productInfoParts.length < 4) continue;

                        packageInfo.productList.push({
                            id: productInfoParts[0],
                            name: productInfoParts[1],
                            status: Number(productInfoParts[2]),
                            order: Number(productInfoParts[3]),
                            executeAfter: Number(productInfoParts[4])
                        });
                    }
                }
            }

            callback();
        },
        callback => {
            if (!req.body.filters.withDetails) return callback();

            product.retrievePackageInfoWithDetails(req.body.filters, data, callback);
        }
    ], err => {
        if (err) {
            return callback(err, req, res);
        }

        callback(null, req, res, data, true);
    });
});

router.post('/package/order', function(req, res) {
    let data = [];
    let sessionInfo = {};
    let packageOrders = {};

    async.series([
        callback => {
            common.verifySession(req.body.userId, req.body.sessionId, callback, sessionInfo, req.headers.referer);
        },
        callback => {
            const filters = req.body.filters;
            filters.offset = Number(filters.offset) || 0;
            filters.limit = Number(filters.limit) || 0;

            let condition = '';
            const replacements = [];
            if (filters.atLeastOneRedeemableProduct) {
                condition = `${condition}  AND pod.execution_status = 3`;
            }
            condition = `${condition} WHERE po.requested_user_id = ?`;
            replacements.push(req.body.userId);
            if (filters.startDate) {
                condition = `${condition} AND po.creation_date >= ?`;
                replacements.push(`${filters.startDate} 00:00:00`);
            }
            if (filters.endDate) {
                condition = `${condition} AND po.creation_date <= ?`;
                replacements.push(`${filters.endDate} 23:59:59`);
            }
            if (filters.offset && filters.limit) {
                condition = `${condition} LIMIT ${filters.offset},${filters.limit}`;
                replacements.push(...[filters.offset, filters.limit]);
            } else if (filters.offset) {
                condition = `${condition} LIMIT ${filters.offset}`;
                replacements.push(filters.offset);
            } else {
                condition = `${condition} LIMIT ${filters.limit}`;
                replacements.push(filters.limit);
            }

            let query = `
            SELECT SQL_CALC_FOUND_ROWS po.package_order_id AS packageOrderId, po.package_id AS packageId, p.package_name AS packageName, 
                   po.execution_ref_id AS executionRefId, pod.package_order_details_id AS packageOrderDetailsId,
                   pod.package_product_id AS packageProductId, pi.product_name AS packageProductName, pi.product_category_id AS packageProductCategoryId,
				   pi.product_value AS productValue, pi.product_reference_1 AS reference1, pi.product_reference_2 AS reference2, pi.product_reference_3 AS reference3,
				   pi.product_reference_4 AS reference4, pi.product_reference_5 AS reference5, pi.product_reference_6 AS reference6, pi.product_reference_7 AS reference7,
                   pi.product_currency_id AS packageProductCurrencyId, c.currency_name AS currencyName, c.currency_iso_alpha_2_code AS isoAlpha2Code,
				   p.package_sales_value AS packageSalesValue, po.creation_date AS packagePurchaseDate,
				   pod.executed_product_id AS executedProductId, pod.execution_id AS executionId,
                   CASE pod.execution_status
                   WHEN 0 THEN 'Failed'
                   WHEN 1 THEN 'Success'
                   WHEN 2 THEN 'Processing'
                   WHEN 3 THEN 'Free'
                   END AS executionStatus
            FROM platform_package_order AS po 
            JOIN (
                SELECT DISTINCT po.package_order_id 
                FROM platform_package_order AS po 
                JOIN platform_package_order_details AS pod 
                ON po.package_order_id = pod.package_order_id
                ${condition}
            ) temp ON po.package_order_id = temp.package_order_id
            JOIN platform_package_order_details AS pod ON po.package_order_id = pod.package_order_id
            JOIN platform_package AS p ON po.package_id = p.package_id
            JOIN platform_product_info AS pi ON pod.package_product_id = pi.product_id
			JOIN platform_currency AS c ON pi.product_currency_id = c.currency_country_id
            `;

            reports.reportQueryExecutionUsingPagination(query, replacements, packageOrders, callback);
        },
        callback => {
            const trackPackageOrders = {};
            packageOrders.data[0]['values'].forEach((item) => {
                if (!trackPackageOrders[item[0]]) {
                    trackPackageOrders[item[0]] = {
                        packageOrderId: item[0],
                        packageId: item[1],
                        packageName: item[2],
                        executionRefId: item[3],
                        orderDetails: []
                    }
                }

                trackPackageOrders[item[0]].orderDetails.push({
                    packageOrderDetailsId: item[4],
                    packageProductId: item[5],
                    packageProductName: item[6],
                    packageProductCategoryId: item[7],
					packageProductValue: item[8],
					packageProductReference1: item[9],
					packageProductReference2: item[10],
					packageProductReference3: item[11],
					packageProductReference4: item[12],
					packageProductReference5: item[13],
					packageProductReference6: item[14],
					packageProductReference7: item[15],
					packageProductCurrencyId: item[16],
					packageProductCurrencyName: item[17],
					packageProductIsoAlpha2Code: item[18],
					packageSalesValue: item[19],
					packagePurchaseDate: item[20],
                    executedProductId: item[21],
                    executionId: item[22],
                    executionStatus: item[23]
                });
            });
            data = Object.values(trackPackageOrders);
            callback();
        }
    ], err => {
        if (err) {
            return callback(err, req, res);
        }

        callback(null, req, res, data);
    });
});

router.post('/channel-list', function(req, res) {
    const channels = [];
    product.fetchChannelList(channels, (err) => {
       if (err) {
           return callback(err, req, res);
       }

       return callback(null, req, res, channels);
    });
});

function checkForProductCreationValues(productValues, callback) {
    if (!productValues.productValue &&
        (!productValues.hasVariableAmount || Number(productValues.hasVariableAmount) === 0)) {
        return callback(resGen.responseGenerator(resGen.INVALID_PARAMS_ERR));
    }

    callback();
}

function classifyPackageProducts(productList) {
    let classification = {
        add: [],
        del: []
    };

    if (productList) {
        for (let index in productList) {
            let product = productList[index];
            product.action === 1 ?
                classification.add.push(
                    {
                        id: product.id,
                        order: product.order,
                        executeAfter: product.executeAfter
                    }) :
                classification.del.push(product.id);
        }
    }

    return classification;
}

module.exports = router;
