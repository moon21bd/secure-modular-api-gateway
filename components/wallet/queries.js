"use strict";

module.exports = {
    addWalletBalance:
        "CALL platform_add_wallet_balance(?, ?, ?, ?, ? ,? ,? ,@error, @errorCode, @errorDescription)",
    getOrVerifyProductWiseWalletTypeID: `CALL platform_get_or_verify_product_wallet_info(?,?,?,?,?,?,?,?)`,

    getWalletOperatorCharge: `SELECT percentage, config_id FROM platform_wallet_operator_charge_config WHERE wallet_type_id = ? AND operator = ? AND config_id = ? AND status = 1`,
    getWalletOperatorCharge: `SELECT percentage, config_id FROM platform_wallet_operator_charge_config WHERE wallet_type_id = ? AND operator = ? AND config_id = ? AND status = 1`,

    getUserPaymentMethods: `
    SELECT 
        cpmu.id, cpmu.user_id, cpmu.balance, cpmu.usage_limit,
        cpmu.expiry, cpm.pm_name, cpm.pm_deduction_type, cpm.role_ids,
        cpm.for_app
        FROM platform_payment_method_users cpmu
    LEFT JOIN platform_payment_methods cpm ON cpmu.pm_id = cpm.id
    WHERE cpmu.status = 1
    AND cpmu.user_id = ? AND cpmu.pm_id = ?
    `,

    createtUserPaymentMethods: function () {
        const digiUsageLimit = global.digiUsageLimitInfo ? global.digiUsageLimitInfo.monthlyLimit : '100'
        return `INSERT INTO platform_payment_method_users (user_id, pm_id, balance, usage_limit, expiry, last_transaction_date, created_by, creation_date)
            VALUES (?, ?, ${digiUsageLimit}, ${digiUsageLimit}, DATE_FORMAT(LAST_DAY(now()), "%Y-%m-%d 23:59:59"), now(), 'admin', now())`

        // Old.
        // `INSERT INTO platform_payment_method_users (user_id, pm_id, balance, usage_limit, expiry, last_transaction_date, created_by, creation_date)
        //     VALUES (?, ?, (SELECT config_param_value FROM platform_configuration t WHERE config_param_name = 'digiUseMonthlyLimit' and status = 1),
        //     (SELECT config_param_value FROM platform_configuration t WHERE config_param_name = 'digiUseMonthlyLimit' and status = 1),
        //     DATE_FORMAT(LAST_DAY(now()), "%Y-%m-%d 23:59:59"), now(), 'admin', now())
        // `,
    },

    fetchPartnerPaymentMethod: `
    SELECT balance as availablePartnerBalance from platform_payment_method_users where user_id = ? and pm_id = ?
    `,

    fetchPartnerUsageLimitConfiguration: `
    SELECT config_param_value as monthlyLimit FROM platform_configuration t WHERE config_param_name = 'digiUseMonthlyLimit' and status = 1
    `,

    changeUserPaymentMethodData: `
    UPDATE platform_payment_method_users SET balance = balance - ?, last_transaction_date = now() WHERE user_id = ? and pm_id = ?
    `,

    updateUserPaymentMethods: function () {
        const digiUsageLimit = global.digiUsageLimitInfo ? global.digiUsageLimitInfo.monthlyLimit : '100'
        return `
            UPDATE platform_payment_method_users SET balance = if(now() > expiry, 
                    ${digiUsageLimit}, balance), expiry  = IF(now() > expiry, DATE_FORMAT(LAST_DAY(now()), "%Y-%m-%d 23:59:59"), expiry)
            WHERE user_id = ? and pm_id = ?`;
    },

    getProductPaymentMethods: `
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

};
