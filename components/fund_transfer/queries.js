'use strict';

module.exports = {
    insertFundTransferConfig: `
        INSERT INTO platform_transfer_config(transfer_from, transfer_to, transfer_product_id, transfer_allow, transfer_id_check, transfer_comission, created_by)
        VALUES(?, ?, ?, ?, ?, ?, ?)
    `,
    updateFundTransferConfig: `
        UPDATE platform_transfer_config
        SET transfer_product_id = IF(? IS NULL, transfer_product_id, IF(? = 0, NULL, ?)),
            transfer_status = IF(? IS NULL, transfer_status, ?),
            transfer_allow = IF(? IS NULL, transfer_allow, ?),
            transfer_id_check = IF(? IS NULL, transfer_id_check, ?),
            transfer_comission = IF(? IS NULL, transfer_comission, ?),
            updated_by = ?
        WHERE transfer_config_id = ?
    `,
    checkForRoleIds: `
        SELECT COUNT(*) AS \`count\` FROM platform_roles WHERE role_id IN (?, ?) AND role_status = 1
    `,
    fetchFundTransferConfig: function(whereCondition) {
        return `
            SELECT tc.transfer_config_id AS configId, tc.transfer_from AS \`from\`, tc.transfer_to AS \`to\`,
                r1.role_name AS fromRoleName, r2.role_name AS toRoleName, IFNULL (tc.transfer_product_id, 0) AS productId,
                pi.product_name AS productName, tc.transfer_status AS \`status\`, tc.transfer_allow AS isAllowed, 
                tc.transfer_id_check AS allowType, tc.transfer_comission AS comission, tc.created_by AS createdBy, 
                tc.updated_by AS updatedBy, tc.creation_date AS createdAt, tc.last_update_date AS updatedAt
            FROM platform_transfer_config AS tc
            JOIN platform_roles AS r1 ON tc.transfer_from = r1.role_id
            JOIN platform_roles AS r2 ON tc.transfer_to = r2.role_id
            LEFT JOIN platform_product_info AS pi ON tc.transfer_product_id = pi.product_id
            ${whereCondition}
        `;
    },
    addBalance: `
        CALL platform_add_balance(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, @errorOccurred, @errorCode, @resultDescription)
    `,
    addBalanceWithSplittingCommission: `CALL platform_add_balance_with_splitting_commision(?,?,?,?,?,?,?,?)`,
    commissionSpilltingDetails: `CALL platform_commission_spiltting_calculate(?,?,?,?,?)`,

    retrieveDataForFundTransfer: `
        SELECT u.user_id AS id, u.user_name AS username, u.user_pwd AS password,  
               u.user_pwd_expiry AS passwordExpiry, u.user_email AS email,  
               u.user_role_id AS roleId, u.user_currency_id AS currencyId,
               u.user_fund_transfer_email_authentication AS emailAuthentication, 
               u.user_fund_transfer_password_authentication AS passwordAuthentication,
               c.currency_name AS currencyName, c.currency_conversion_rate AS conversionRate, u.user_mobileno AS mobileNo,u.user_country_code AS countryCode
        FROM platform_users AS u
        JOIN platform_currency AS c ON u.user_currency_id = c.currency_country_id
        JOIN platform_roles AS r ON u.user_role_id = r.role_id
        WHERE u.user_id IN (?, ?) AND r.role_status = 1
    `,
    fundTransferQuery: "CALL platform_fund_transfer(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, @errorOccurred, @errorCode, @resultDescription)",
    callTransactionCommissionProc: `CALL platform_add_transaction_commission(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, @e, @m, @tid)`,
    updateTransactionCommission: `
        UPDATE platform_transaction_commission 
        SET cash_status = ?,
            cash_remarks = ?,
            updated_by = ?
        WHERE transaction_commission_id = ? AND cash_status = 2
    `,
    getRoleWiseTransferLimit:`SELECT transfer_limit_to_role As newRole,transfer_limit_amount_min As lowerLimit,transfer_limit_amount_max As higherLimit, transfer_limit_channel 
FROM platform_role_wise_transfer_limit WHERE transfer_limit_from_role=? AND transfer_limit_channel=?`,
    insertTransferCommission: `INSERT INTO platform_transaction_commission(cash_platform_id,cash_transaction_type, cash_transaction_id, cash_agent_id, cash_product_code,cash_platform_product_id, cash_amount, cash_commission_amount, cash_status,cash_remarks, created_by)
    VALUES (?,?, ?, ?, ?, ?,?, ?,?, ?,?)`,
    fetchParentInfo: `
        SELECT p.user_id AS userId, p.user_role_id AS roleId FROM platform_users AS p JOIN platform_users AS c ON p.user_id = c.user_parent_id WHERE c.user_id = ? 
    `,
    fetchLastTransferredByInfo: `
        SELECT ltb.user_id AS userId, ltb.user_role_id AS roleId FROM platform_users AS ltb JOIN platform_users AS c ON ltb.user_id = c.last_transferred_by AND (c.last_transfer_date >= DATE_SUB(NOW(), INTERVAL ? DAY)) WHERE c.user_id = ?
    `,
    fetchUserRoleId: `
        SELECT user_role_id AS roleId, referred_by as referredBy FROM platform_users where user_id = ?
    `,
    storeFundTransferRecord: `
        INSERT INTO platform_transfer_history(transfer_ref_id, transfer_from, transfer_to, transfer_type, transfer_payment_channel, transfer_from_original_currency, transfer_from_currency_amount, transfer_from_base_currency_amount, transfer_to_amount, transfer_to_prev_balance, transfer_to_new_balance, transfer_status, transfer_status_note, transfer_channel, created_by)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    fetchGrandParentInfo: `
        SELECT gp.user_id AS userId, gp.user_role_id AS roleId 
        FROM platform_users AS gp 
        JOIN platform_users AS p ON gp.user_id = p.user_parent_id 
        JOIN platform_users AS c ON p.user_id = c.user_parent_id
        WHERE c.user_id = ?
    `,
    fetchJompayTransactionLimit: `
        SELECT cb.min_amount AS minAmount, cb.update_time as updateTime, cr.role_name as roleName
        FROM platform_bank_transaction_limits AS cb
        LEFT JOIN platform_roles cr ON cr.role_id = ?
        WHERE cb.bank=? AND cb.status = 1 AND find_in_set(?, cb.role_id)
    `
}
