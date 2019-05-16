"use strict"

const utils = require("../../lib/utils")

module.exports = {
    checkOrderInfo:
        "CALL platform_get_or_verify_product_info(?, ?, ?, ?, ?, ?, ?, @error, @errorCode, @errorDescription, @originalAmount,@deductibleAmount, @comission, @discount, @currencyId, @conversionRate, @r1, @r2, @r3, @r4, @r5, @r6, @r7,@wallet_type_id,@wallet_name,@wallet_balance,@walletId,@userOriginCurrencyConversionRate,@product_service_charge,@product_service_charge_rate, @product_service_charge_type)",
    checkOrderInfoSales:
        "CALL platform_get_or_verify_product_info_sales_for_sales_portal(?, ?, ?, ?, ?, ?, @error, @errorCode, @errorDescription, @originalAmount, @deductibleAmount, @comission, @discount, @currencyId, @conversionRate, @r1, @r2, @r3, @r4, @r5, @r6, @r7)",
    getOrVerifyProductWiseWalletTypeID: `CALL platform_get_or_verify_product_wallet_info(?,?,?,?,?,?,?,?)`,

    getOrderInfo:
        "SELECT @error, @errorCode, @errorDescription, @originalAmount, @deductibleAmount, @comission, @discount, @currencyId, @conversionRate, @r1, @r2, @r3, @r4, @r5, @r6, @r7,@wallet_type_id,@wallet_name,@wallet_balance,@walletId,@userOriginCurrencyConversionRate,@product_service_charge,@product_service_charge_rate,@product_service_charge_type",
    getUserPaymentMethods: `
    SELECT 
        cpmu.id,
        cpmu.user_id,
        cpmu.balance,
        cpmu.usage_limit,
        cpmu.expiry,
        cpm.pm_name,
        cpm.pm_deduction_type,
        cpm.role_ids,
        cpm.for_app
    FROM platform_payment_method_users cpmu
        left join platform_payment_methods cpm on cpmu.pm_id = cpm.id
    WHERE cpmu.status = 1
    and cpmu.user_id = ?
    and (product_ids = 'all' or find_in_set(?, product_ids))
    `,
    retrieveConfigurationDataForOrder: `
        SELECT u.user_pwd AS password, u.user_pwd_expiry AS passwordExpiry, u.user_role_id AS roleId, 
               u.user_email AS email, us.user_settings_password_authentication AS passwordAuth, 
               us.user_settings_email_authentication AS emailAuth
        FROM platform_users AS u JOIN platform_user_settings AS us
        ON u.user_id = us.user_settings_user_id
        WHERE u.user_id = ? AND us.user_settings_product_category_id = ?
    `,
    retrieveUserDataForOrder: `
        SELECT u.user_pwd AS password, u.user_pwd_expiry AS passwordExpiry, u.user_role_id AS roleId, u.user_email AS email
        FROM platform_users AS u WHERE u.user_id = ?
    `,
    discounts: `
        SELECT temp.rateType, pi.product_id AS productId, pi.product_name AS productName, 
               1 AS \`type\`, temp.discountAmount, pi.product_sales_value AS salesValue
        FROM platform_product_info AS \`pi\`
        JOIN platform_product_category AS pc ON pi.product_category_id = pc.category_id
        LEFT JOIN (
        SELECT pr.rate_id AS rateId, pr.rate_type AS rateType, pr.rate_productid AS productId, pr.rate_priority AS priority,
               CASE  
               WHEN (pr.rate_type = 'comission' AND pi.product_comission_applicable = 1 AND pr.rate_applicable_type = 0) THEN pr.rate_amount
               WHEN (pr.rate_type = 'discount' AND pi.product_discount_applicable = 1 AND pr.rate_applicable_type = 0) THEN pr.rate_amount
               WHEN (pr.rate_type = 'comission' AND pi.product_comission_applicable = 1 AND pr.rate_applicable_type = 1) THEN platform_round_amount((pi.product_sales_value * pr.rate_amount) / 100, 0)
               WHEN (pr.rate_type = 'discount' AND pi.product_discount_applicable = 1 AND pr.rate_applicable_type = 1) THEN platform_round_amount((pi.product_sales_value * pr.rate_amount) / 100, 0)
               ELSE 0
               END discountAmount
        FROM platform_product_rates AS pr 
        JOIN platform_product_info AS \`pi\` ON pr.rate_productid = pi.product_id
        JOIN platform_product_category AS pc ON pi.product_category_id = pc.category_id
        WHERE pr.rate_status = 1 AND 
            (pr.rate_roleid IS NULL OR pr.rate_roleid = ?) AND 
            (pr.rate_userid IS NULL OR pr.rate_userid = ?) AND
            pc.category_id = ?
        ) AS temp ON pi.product_id = temp.productId
        WHERE pc.category_id = ?
        ORDER BY pi.product_id, temp.priority, temp.rateId DESC
    `,
    executionHistoryForScratchCard: function (partition) {
        return `
            SELECT eh.execution_mobile_no AS 'MSISDN', 
                (pi.product_reference_7 IS NULL OR pi.product_reference_7 = '1') AS canShowAmount,
                pi.product_name AS Product, CONCAT(TRUNCATE(eh.execution_amount, 2), ' ', c.currency_name) AS Amount,
                IF (eh.execution_type = ${utils.executionType.PLATFORM_DIALER}, 'Platform Dialer', eh.execution_operator) AS Operator, 
                CASE(eh.execution_status)
                    WHEN 0 THEN 'Failed'
                    WHEN 1 THEN 'Success'
                    WHEN 2 THEN 'Processing'
                END AS 'Execution Status', 
               DATE_FORMAT(eh.execution_request_time, '%e-%b-%Y %T') AS 'Request Time', 
               DATE_FORMAT(eh.last_update_date, '%e-%b-%Y %T') AS 'Execution Time'
            FROM platform_execution_history ${partition} AS eh
            JOIN platform_product_info AS \`pi\` ON eh.execution_product_id = pi.product_id
            JOIN platform_currency AS c ON eh.execution_currency_id = c.currency_country_id
            WHERE eh.execution_product_serial_no = ?
            AND eh.creation_date >= ?
            ORDER BY canShowAmount ASC
        `
    },
    executionStatus: function (whereCondition) {
        return `
            SELECT execution_transaction_ref_id AS tid, execution_status AS status, execution_remarks AS remarks, execution_response_message AS messageDetails, execution_operator AS operator
            FROM platform_execution_history
            ${whereCondition} AND creation_date >= DATE_SUB( NOW( ), INTERVAL 3 DAY ) LIMIT 1`;
    },
    executionTransactionId: `
        SELECT execution_transaction_id AS transactionId
        FROM platform_execution_history
        WHERE execution_received_transaction_id = ?
        ORDER BY execution_transaction_id DESC
        LIMIT 1
    `,
    updateSoftPinInfo: `
        UPDATE platform_execution_history
        SET execution_sender = ?
        WHERE execution_transaction_ref_id = ? AND execution_status = 1
    `,
    storeExecutionRecord: `
        INSERT INTO platform_execution_history(execution_client_transaction_id, execution_type, execution_config_id, execution_product_id, execution_product_serial_no, execution_amount, execution_sales_amount, execution_currency_id, execution_user_id, execution_mobile_no, execution_sender, execution_operator, execution_channel, execution_status, execution_request_time, execution_last_time, execution_next_time, created_by)
        VALUES(?, ?, 0, ?, ?, ?, ?, ?, 0, ?, 'NA', 'NA', ?, 1, now(), now(), now(), ?)
    `,
    fetchProductCategoryInfo: `
        SELECT pi.product_category_id as categoryId, pc.category_name as categoryName
            FROM platform_product_info pi
            LEFT JOIN platform_product_category pc on pi.product_category_id = pc.category_id
        WHERE pi.product_id = ?

    `,
    keyForEngineTask: function (taskId) {
        return "engine.task." + taskId
    },
    keyForDuplicateOrderRequest: function (mobileNo) {
        return "dup.order." + mobileNo
    },
    keyForBulkOrderRequests: function (batchId) {
        return "bulk.order." + batchId
    },
    keyForBulkOrderRequestInfo: function (batchId) {
        return "bulk.order.info." + batchId
    },
    keyForThirdPartyTrxIdMap: function (thirdPartyTrxId) {
        return "trx_map." + thirdPartyTrxId
    },
    keyForTransactionCallback: function (transactionRefId) {
        return "trx_callback." + transactionRefId
    },
    keyForPartnerTransactions: function (transactionId) {
        return "paymentMethod." + transactionId + ".1"
    }
}
