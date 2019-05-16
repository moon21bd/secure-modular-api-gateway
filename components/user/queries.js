"use strict"

module.exports = {
    signUp: "CALL platform_create_user_profile(?, ?, ?, NULL, NULL, ?, ?, ?, ?, @errorOccurred, @errorCode, @errorDescription)",
    signUpApp: `
        CALL platform_create_user_profile_generic(?, ?, ?, NULL, NULL, ?, ?, ?, ?,?,?,?,?,?,?, @errorOccurred, @errorCode, @errorDescription)
    `,
    login: `
        SELECT u.user_id AS userId, u.user_name AS username, u.user_app_token AS appToken,u.user_parent_id AS parentId, pu.user_name AS parentUserName, 
               pu.user_mobileno AS parentMobileNo, pu.user_country_code AS parentCountryCode, u.previous_mobile_no AS previousMobileNo,
               u.user_full_name AS fullName, u.user_pwd AS password, u.user_pwd_expiry AS passwordExpiry, u.user_role_id AS roleId,
               u.user_status AS status, u.user_email AS email, u.user_country_code AS countryCode, u.is_mobile_updated AS isMobileUpdated,
               u.is_business_agreement AS isBusinessAgreement, u.notification_count as inAppNotificationCount, u.is_email_updated as isEmailUpdated, 
               IF(u.is_business_agreement = 0,(select IF(count(config_param_id) > 0, 1,0) from platform_configuration 
               where status=1 and config_param_name = 'requiredBusinessAgreementRoles' and 
               (config_param_value = 'all' or find_in_set(u.user_role_id, config_param_value))), 0) AS isRequiredBusinessAgreement,
               u.user_mobileno AS mobileNo, u.user_profile_pic AS profilePicture, u.user_passport_pic AS passportPicture,
               u.user_login_email_authentication AS loginEmailAuthentication, 
               u.user_fund_transfer_password_authentication AS fundTransferPasswordAuthentication,
               CAST((u.user_balance * c.currency_conversion_rate) AS DECIMAL(20,2)) AS userBalance,
               u.user_failed_login_attempt AS failedLoginAttempt, u.user_last_login_time AS lastLoginTime, 
               u.user_auto_update AS autoUpdate, u.user_nationality AS nationality, u.user_latitude AS latitude, u.user_longitude AS longitude,
               c.currency_country_id AS currencyId, c.currency_name AS currencyName, r.role_name AS roleName,
               r.role_menu_permission AS menuPermission, r.role_status AS roleStatus, r.role_level AS roleLevel,
               GROUP_CONCAT(pc.category_id) AS categoryIdList, GROUP_CONCAT(pc.category_name) AS categoryList, 
               GROUP_CONCAT(pc.category_is_viewable) AS viewableList, 
               GROUP_CONCAT(us.user_settings_password_authentication) AS passwordAuthenticationList, 
               GROUP_CONCAT(us.user_settings_email_authentication) AS emailAuthenticationList,
               CONCAT(role_setting_allowed_user_type, ',', role_setting_allow_all_status, ',', role_setting_allow_all_role,
                      ',', role_setting_allow_all_route, ',', role_settings_allow_product_execution_update) AS roleSettings
        FROM platform_users AS u LEFT JOIN platform_users AS pu ON u.user_parent_id = pu.user_id
        LEFT JOIN platform_roles AS r 
            INNER JOIN platform_role_setting AS rs ON r.role_id = rs.role_id
            ON u.user_role_id = r.role_id
        JOIN platform_currency AS c ON u.user_currency_id = c.currency_country_id
        LEFT JOIN platform_user_settings AS us 
            INNER JOIN platform_product_category AS pc ON us.user_settings_product_category_id = pc.category_id
            ON u.user_id = us.user_settings_user_id
        WHERE (u.user_name = ? )
    `,
    balanceInquiry: `Select user_balance AS balance FROM platform_users WHERE user_name=?`,
    balanceInquiryByStatus: `Select user_balance AS balance FROM platform_users WHERE user_name=? and user_status=?`,
    retrieveWalletInformationByUserName: `SELECT cbw.wallet_type_id AS walletTypeId,cbw.wallet_balance AS walletBalance,cbwt.wallet_type_name AS walletName FROM platform_users cbu
LEFT JOIN platform_wallet cbw ON cbw.wallet_user_id = cbu.user_id 
LEFT JOIN platform_wallet_type cbwt ON cbwt.wallet_type_id = cbw.wallet_type_id

WHERE cbu.user_name=?`,
    balanceInquiryByUserId: `Select platform_currency_convertion(?,user_balance,'-1') AS balance, security_deposit_amount FROM platform_users WHERE user_id=?`,

    userInfoForB2bServices: ` SELECT u.user_id AS userId,u.user_pwd AS password,u.user_balance AS balance,u.user_pwd AS hashedPassword ,u.user_name AS username, u.user_app_token AS appToken,u.user_parent_id AS parentId, pu.user_name AS parentUserName, 
               pu.user_mobileno AS parentMobileNo, pu.user_country_code AS parentCountryCode,
               u.user_full_name AS fullName, u.user_pwd_expiry AS passwordExpiry, u.user_role_id AS roleId,
               u.user_status AS status, u.user_email AS email, u.user_country_code AS countryCode, 
               u.user_mobileno AS mobileNo, u.user_profile_pic AS profilePicture, u.user_passport_pic AS passportPicture,
               u.user_login_email_authentication AS loginEmailAuthentication, 
               u.user_fund_transfer_password_authentication AS fundTransferPasswordAuthentication,
               (u.user_balance * c.currency_conversion_rate) AS userBalance,
               u.user_failed_login_attempt AS failedLoginAttempt, u.user_last_login_time AS lastLoginTime, 
               c.currency_country_id AS currencyId, c.currency_name AS currencyName, r.role_name AS roleName,
               r.role_menu_permission AS menuPermission, r.role_status AS roleStatus, r.role_level AS roleLevel,
               GROUP_CONCAT(pc.category_id) AS categoryIdList, GROUP_CONCAT(pc.category_name) AS categoryList, 
               GROUP_CONCAT(pc.category_is_viewable) AS viewableList, 
               GROUP_CONCAT(us.user_settings_password_authentication) AS passwordAuthenticationList, 
               GROUP_CONCAT(us.user_settings_email_authentication) AS emailAuthenticationList,
               CONCAT(role_setting_allowed_user_type, ',', role_setting_allow_all_status, ',', role_setting_allow_all_role,
                      ',', role_setting_allow_all_route, ',', role_settings_allow_product_execution_update) AS roleSettings
        FROM platform_users AS u LEFT JOIN platform_users AS pu ON u.user_parent_id = pu.user_id
        LEFT JOIN platform_roles AS r 
            INNER JOIN platform_role_setting AS rs ON r.role_id = rs.role_id
            ON u.user_role_id = r.role_id
        JOIN platform_currency AS c ON u.user_currency_id = c.currency_country_id
        LEFT JOIN platform_user_settings AS us 
            INNER JOIN platform_product_category AS pc ON us.user_settings_product_category_id = pc.category_id
            ON u.user_id = us.user_settings_user_id
        WHERE (u.user_name = ? )`,
    loginWithOtp: `
        SELECT u.user_name AS username,  u.user_full_name AS fullName, u.user_parent_id AS parentId, pu.user_name AS parentUserName, 
               pu.user_mobileno AS parentMobileNo, pu.user_country_code AS parentCountryCode,
               u.user_email AS email, u.user_country_code AS countryCode, u.user_mobileno AS mobileNo, u.user_profile_pic AS profilePicture,
               u.user_fund_transfer_password_authentication AS fundTransferPasswordAuthentication,
               (u.user_balance * c.currency_conversion_rate) AS userBalance, u.user_failed_login_attempt AS failedLoginAttempt, 
               u.user_last_login_time AS lastLoginTime, c.currency_country_id AS currencyId, 
               c.currency_name AS currencyName, u.user_role_id AS roleId, r.role_name AS roleName,
               r.role_menu_permission AS menuPermission, r.role_level AS roleLevel,
               GROUP_CONCAT(pc.category_id) AS categoryIdList, GROUP_CONCAT(pc.category_name) AS categoryList, 
               GROUP_CONCAT(pc.category_is_viewable) AS viewableList, 
               GROUP_CONCAT(us.user_settings_password_authentication) AS passwordAuthenticationList, 
               GROUP_CONCAT(us.user_settings_email_authentication) AS emailAuthenticationList,
               CONCAT(role_setting_allowed_user_type, ',', role_setting_allow_all_status, ',', role_setting_allow_all_role,
                      ',', role_setting_allow_all_route, ',', role_settings_allow_product_execution_update) AS roleSettings
        FROM platform_users AS u LEFT JOIN platform_users AS pu ON u.user_parent_id = pu.user_id
        LEFT JOIN platform_roles AS r 
            INNER JOIN platform_role_setting AS rs ON r.role_id = rs.role_id
            ON u.user_role_id = r.role_id 
        JOIN platform_currency AS c ON u.user_currency_id = c.currency_country_id
        LEFT JOIN platform_user_settings AS us 
            INNER JOIN platform_product_category AS pc ON us.user_settings_product_category_id = pc.category_id
            ON u.user_id = us.user_settings_user_id
        WHERE u.user_id = ?
    `,
    userInfoUsingId: `
        SELECT u.user_id AS userId, u.user_name AS username, u.user_parent_id AS parentId, pu.user_name AS parentUserName,
               u.user_full_name AS fullName, u.user_pwd AS password, u.user_pwd_expiry AS passwordExpiry, u.user_role_id AS roleId,
               u.user_status AS status, u.user_email AS email, u.user_country_code AS countryCode,
               u.user_mobileno AS mobileNo, u.user_profile_pic AS profilePicture, u.user_passport_pic AS passportPicture,
               u.user_login_email_authentication AS loginEmailAuthentication,
               u.user_fund_transfer_password_authentication AS fundTransferPasswordAuthentication,
               (u.user_balance * c.currency_conversion_rate) AS userBalance, u.user_failed_login_attempt AS failedLoginAttempt, 
               u.user_last_login_time AS lastLoginTime, u.user_referral_count AS referralCount,
               c.currency_country_id AS currencyId, c.currency_name AS currencyName, r.role_name AS roleName,
               r.role_menu_permission AS menuPermission, r.role_status AS roleStatus,c.pgw_currency_iso_code AS pgwCurrencyCode,c.currency_conversion_rate AS currencyConvertionRate
        FROM platform_users AS u LEFT JOIN platform_users AS pu ON u.user_parent_id = pu.user_id
        JOIN platform_roles AS r ON u.user_role_id = r.role_id
        JOIN platform_currency AS c ON u.user_currency_id = c.currency_country_id
        WHERE u.user_id = ?
    `,
    getUserByUsernameOrId: `select 
    u.user_id AS userId, u.user_name AS username, u.user_parent_id AS parentId,
               u.user_full_name AS fullName, u.user_pwd AS password, u.user_pwd_expiry AS passwordExpiry, u.user_role_id AS roleId,
               u.user_status AS status, u.user_email AS email, u.user_country_code AS countryCode,
               u.user_mobileno AS mobileNo, u.user_profile_pic AS profilePicture, u.user_passport_pic AS passportPicture,
               u.user_login_email_authentication AS loginEmailAuthentication,
               u.user_fund_transfer_password_authentication AS fundTransferPasswordAuthentication,
               u.user_balance AS userBalance, u.user_failed_login_attempt AS failedLoginAttempt, 
               u.user_last_login_time AS lastLoginTime, u.user_referral_count AS referralCount
    from platform_users u 
    where u.user_id > 0 and (u.user_id = ? or u.user_name = ?)
    `,
    incrementLogInAttempt: `
        UPDATE platform_users SET user_status = IF(user_failed_login_attempt = ?, 'Locked', user_status), 
                             user_failed_login_attempt = IF(user_failed_login_attempt = ?, user_failed_login_attempt, user_failed_login_attempt + 1),
                             updated_by = ?
        WHERE user_id = ?
    `,
    updateLastLoginTime: `
        UPDATE platform_users SET user_last_login_time = NOW(), user_failed_login_attempt = 0, updated_by = ? WHERE user_id = ?
    `,
    specificUserInfo: `
        SELECT u.user_id AS userId, u.user_name AS username, u.user_full_name AS fullName, u.user_pwd_expiry AS passwordExpiryDate, 
               u.user_role_id AS roleId, r.role_name AS roleName, r.role_level AS roleLevel, u.user_status AS status,  
               u.user_parent_id AS parentId, u.user_contact_id AS contactId, u.user_email AS email, u.user_country_code AS countryCode, 
               u.user_mobileno AS mobileNo, u.user_currency_id AS currencyId, u.user_profile_pic AS profilePicture, 
               u.user_login_email_authentication AS loginEmailAuthentication, u.user_route_id AS routeId,
               u.user_fund_transfer_email_authentication AS fundTransferEmailAuthentication,
               u.user_fund_transfer_password_authentication AS fundTransferPasswordAuthentication, 
               u.user_forget_password_email_authentication AS forgetPasswordEmailAuthentication,
               u.user_device_registration_email_authentication AS deviceRegistrationEmailAuthentication,
               u.referred_by,
               u.security_deposit_amount,
               u.user_fund_transfer_password_authentication AS fundTransferPasswordAuthentication, u.user_nationality as nationality,
               u.user_latitude AS latitude, u.user_longitude AS longitude,
               GROUP_CONCAT(pc.category_id) AS categoryIdList, GROUP_CONCAT(pc.category_name) AS categoryList, 
               GROUP_CONCAT(pc.category_is_viewable) AS viewableList, 
               GROUP_CONCAT(us.user_settings_password_authentication) AS passwordAuthenticationList, 
               GROUP_CONCAT(us.user_settings_email_authentication) AS emailAuthenticationList,
               u.user_profile_pic AS profilePicture, u.user_passport_pic AS passportPicture,
               u.user_balance AS balance, u.user_last_login_time AS lastLoginTime,
               u.is_business_agreement AS isBusinessAgreement,
               IF(u.is_business_agreement = 0,(select IF(count(config_param_id) > 0, 1,0) from platform_configuration 
               where status=1 and config_param_name = 'requiredBusinessAgreementRoles' and 
               (config_param_value = 'all' or find_in_set(u.user_role_id, config_param_value))), 0) AS isRequiredBusinessAgreement
        FROM platform_users AS u
            JOIN platform_roles AS r ON u.user_role_id = r.role_id
            LEFT JOIN platform_user_settings AS us 
                INNER JOIN platform_product_category AS pc ON us.user_settings_product_category_id = pc.category_id
            ON u.user_id = us.user_settings_user_id
        WHERE u.user_id = ?
    `,
    parentIdCheck: `
        SELECT 1 AS isExists FROM platform_users WHERE user_id = ? AND user_parent_id IS NOT NULL
    `,
    supportContacts: `
        SELECT * FROM platform_supports WHERE status=1 and (app_support_type = 'all' or find_in_set(?, app_support_type))
    `,

    checkUser: `
        SELECT user_status FROM platform_users WHERE user_id = ?
    `,
    checkExistingUser: `
        SELECT user_status FROM platform_users WHERE user_name = ?
    `,
    retrievePassword: "replace-me",
    updatePassword: `
        UPDATE platform_users AS u, (SELECT config_param_value AS \`interval\` FROM platform_configuration WHERE config_param_name = 'passwordExpiry') AS expiry_interval
        SET u.user_pwd = ?, 
            u.user_pwd_expiry = DATE(DATE_ADD(NOW(), INTERVAL expiry_interval.interval MONTH)),
            user_failed_login_attempt = 0,
            updated_by = ?
        WHERE user_id = ?
    `,
    updateUserAppToken: ` UPDATE platform_users AS u
        SET u.user_app_token = ?, 
            u.last_update_date = NOW(),
            updated_by = ?
        WHERE user_id = ?`,
    userList: `
        SELECT u.user_id AS userId, u.user_name AS username, u.user_full_name AS fullName, u.user_pwd_expiry AS passwordExpiryDate, u.user_role_id AS roleId,
               r.role_name AS roleName, r.role_level AS roleLevel, u.user_status AS status, u.user_parent_id AS parentId, u.user_contact_id AS contactId, 
               u.user_email AS email, u.user_country_code AS countryCode, u.user_mobileno AS mobileNo, u.user_currency_id AS currencyId,  
               u.user_profile_pic AS profilePicture, u.user_passport_pic AS passportPicture, u.user_balance AS balance, u.user_route_id AS routeId, u.user_last_login_time AS lastLoginTime
        FROM platform_users AS u JOIN platform_roles AS r ON u.user_role_id = r.role_id
        WHERE r.role_level > (SELECT r.role_level FROM platform_users AS u JOIN platform_roles AS r ON u.user_role_id = r.role_id WHERE u.user_id = ?)
        ORDER BY u.user_id ASC
    `,
    // resellerList: `
    //     SELECT u.user_id AS userId, u.user_name AS username, u.user_full_name AS fullName, u.user_pwd_expiry AS passwordExpiryDate, u.user_role_id AS roleId,
    //            r.role_name AS roleName, r.role_level AS roleLevel, u.user_status AS status, u.user_parent_id AS parentId, u.user_contact_id AS contactId,
    //            u.user_email AS email, u.user_country_code AS countryCode, u.user_mobileno AS mobileNo, u.user_currency_id AS currencyId,
    //            u.user_profile_pic AS profilePicture, u.user_balance AS balance, u.user_last_login_time AS lastLoginTime
    //     FROM platform_users AS u JOIN platform_roles AS r ON u.user_role_id = r.role_id
    //     WHERE u.user_parent_id = ?
    //     ORDER BY u.user_id ASC
    // `,
    cashAgentList: `
        SELECT u.user_id AS userId, u.user_cash_agent_id AS cashAgentId, u.user_name AS username, u.user_full_name AS fullName, u.user_pwd_expiry AS passwordExpiryDate, 
               u.user_role_id AS roleId, r.role_name AS roleName, r.role_level AS roleLevel, u.user_status AS status, u.user_parent_id AS parentId, u.user_contact_id AS contactId, 
               u.user_email AS email, u.user_country_code AS countryCode, u.user_mobileno AS mobileNo, u.user_currency_id AS currencyId,  
               u.user_profile_pic AS profilePicture, u.user_balance AS balance, u.user_last_login_time AS lastLoginTime
        FROM platform_users AS u JOIN platform_roles AS r ON u.user_role_id = r.role_id
        WHERE u.user_cash_agent_id IS NOT NULL
    `,
    updateUserProfile: `
        UPDATE platform_users SET user_full_name = IF(? IS NULL, user_full_name, ?),
                             user_parent_id = IF(? IS NULL, user_parent_id, ?),
                             user_contact_id = IF(? IS NULL, user_contact_id, ?),
                             user_pwd = IF(? IS NULL, user_pwd, ?),
                             user_pwd_expiry = IF(? IS NULL, user_pwd_expiry, DATE(DATE_ADD(NOW(), INTERVAL (SELECT config_param_value AS \`interval\` FROM platform_configuration WHERE config_param_name = 'passwordExpiry') MONTH))),
                             user_failed_login_attempt = IF(? IS NULL, user_failed_login_attempt, 0),
                             user_status = IF(? IS NULL, user_status, ?),
                             user_email = IF(? IS NULL, user_email, ?),
                             user_role_id = IF(? IS NULL, user_role_id, ?),
                             user_login_email_authentication = IF(? IS NULL, user_login_email_authentication, ?),
                             user_fund_transfer_email_authentication = IF(? IS NULL, user_fund_transfer_email_authentication, ?),
                             user_fund_transfer_password_authentication = IF(? IS NULL, user_fund_transfer_password_authentication, ?),
                             user_forget_password_email_authentication = IF(? IS NULL, user_forget_password_email_authentication, ?),
                             user_device_registration_email_authentication = IF(? IS NULL, user_device_registration_email_authentication, ?),
                             user_route_id = IF(? IS NULL, user_route_id, ?),
                             user_profile_pic = IF(? IS NULL, user_profile_pic, ?),
                             user_passport_pic = IF(? IS NULL, user_passport_pic, ?),
                             user_latitude = IF(? IS NULL, user_latitude, ?),
                             user_longitude = IF(? IS NULL, user_longitude, ?),
                             updated_by = ?, last_update_date = NOW()
        where user_id = ?
    `,
    updateUserSettings: `
        UPDATE platform_user_settings SET user_settings_password_authentication = IF(? IS NULL, user_settings_password_authentication, ?),
                                     user_settings_email_authentication = IF(? IS NULL, user_settings_email_authentication, ?),
                                     updated_by = ?, last_update_date = NOW()
        WHERE user_settings_user_id = ? AND user_settings_product_category_id = ?
    `,
    createUserProfile: `
        CALL platform_create_user_profile(?, ?, ?, ?, ?, ?, ?, ?, ?, @errorOccurred, @errorCode, @errorDescription)
    `,
    createUserProfileGeneric: `
        CALL platform_create_user_profile_generic(?, ?, ?, ?, ?, ?, ?, ?, ?,?,?,?,?,?,?, @errorOccurred, @errorCode, @errorDescription)
    `,
    createResellerProfile: `
        CALL platform_create_reseller_profile(?, ?, ?, ?, ?, ?, ?, ?, @errorOccurred, @errorCode, @errorDescription)
    `,
    checkIfUserCurrencyIsActive: `
        SELECT c.currency_status AS status
	    FROM platform_users AS u JOIN platform_currency AS c ON u.user_currency_id = c.currency_country_id
	    WHERE u.user_id = ?
    `,
    cashAgentId: `
        UPDATE platform_users SET user_cash_agent_id = ?, updated_by = ?
        WHERE user_id = ? AND user_cash_agent_id IS NULL
    `,
    fetchCashAgentId: `
        SELECT user_cash_agent_id AS cashAgentId FROM platform_users
        WHERE user_id = ? AND user_cash_agent_id IS NOT NULL
    `,
    contactUserInfo: `
       SELECT self.user_role_id AS roleId, self.user_name AS username, 
              contact.user_name AS contactUserName, contact.user_id AS contactUserId
        FROM platform_users AS self 
        LEFT JOIN platform_users AS contact ON self.user_contact_id = contact.user_id
        WHERE self.user_id = ?
    `,
    updateUserRoleQuery: `UPDATE platform_users SET user_role_id=? WHERE user_id=?`,
    userContactList: `
        SELECT user_id AS userId, user_name AS username
        FROM platform_users
        WHERE user_role_id IN (?)
    `,
    keyForSessionId: function (userId, uuid) {
        return "sessionid." + userId + "." + uuid
    },
    userDetailsForCallBackQuery: `SELECT user_name AS userName, user_role_id AS userRoleId,user_parent_id AS parentId FROM platform_users WHERE user_id=?`,
    retrieveUserWalletDetailsByUserId: `SELECT CAST(platform_currency_convertion(u.user_id,cbw.wallet_balance,'-1') AS DECIMAL(10,2))  AS walletBalance,cbwt.wallet_type_name
            FROM platform_users u 
            LEFT JOIN platform_wallet cbw ON u.user_id = cbw.wallet_user_id
            LEFT JOIN platform_wallet_type cbwt ON cbw.wallet_type_id = cbwt.wallet_type_id  
            WHERE u.user_id = ?`,
    // specificUserMenuInfo: `SELECT cm.platform_menu_id AS menuId,cm.platform_menu_type AS menuType,cm.platform_menu_name AS menuName,
    //                             cm.platform_menu_icon AS menuIcon, cm.platform_menu_parent_id  AS menuParentId,
    //                             cm.platform_menu_level AS menuLevel,cm.platform_menu_order AS menuOrder,cm.platform_menu_action_type AS menuActionType, cm.platform_menu_link AS menuLink ,cm.platform_menu_link_type AS menuLinkType FROM platform_menu_permissions cmp
    //                             LEFT JOIN platform_menu cm ON cm.platform_menu_id =  cmp.platform_menu_id
    //                             WHERE cmp.platform_role_id=? AND (cmp.platform_menu_applicable_country = '-1' OR cmp.platform_menu_applicable_country = ?)
    //                             AND cmp.status = 1`,
    specificUserMenuInfo: `SELECT cm.platform_menu_id AS menuId,cm.platform_menu_type AS menuType,cm.platform_menu_name AS menuName,
                                cm.platform_menu_icon AS menuIcon, IF(? = 'user_app', cm.menu_parent_id_userapp, cm.platform_menu_parent_id) AS menuParentId,
                                cm.platform_menu_level AS menuLevel,cm.platform_menu_order AS menuOrder,cm.platform_menu_action_type AS menuActionType, cm.platform_menu_link AS menuLink ,cm.platform_menu_link_type AS menuLinkType FROM platform_menu_permissions cmp 
                                LEFT JOIN platform_menu cm ON cm.platform_menu_id =  cmp.platform_menu_id 
                                WHERE cmp.platform_role_id=? AND (cmp.platform_menu_applicable_country = '-1' OR cmp.platform_menu_applicable_country = ?)
                                AND cmp.status = 1`,

    retrieveUserInfoForgetPassword: `SELECT user_name AS userName,user_id AS userId,user_mobileno AS mobileNo,user_country_code AS countryCode, user_email AS email, user_forget_password_email_authentication AS forgetPasswordEmailAuthentication FROM platform_users WHERE user_name=? LIMIT 1`,
    userInfoUsingIdForPromotions: `
        SELECT u.user_id AS userId, u.user_name AS username, u.user_parent_id AS parentId, pu.user_name AS parentUserName,
               u.user_full_name AS fullName, u.user_pwd AS password, u.user_pwd_expiry AS passwordExpiry, u.user_role_id AS roleId,
               u.user_status AS status, u.user_email AS email, u.user_country_code AS countryCode,
               u.user_mobileno AS mobileNo, u.user_profile_pic AS profilePicture, u.user_passport_pic AS passportPicture,
               u.user_login_email_authentication AS loginEmailAuthentication,
               u.user_fund_transfer_password_authentication AS fundTransferPasswordAuthentication,
               (u.user_balance * c.currency_conversion_rate) AS userBalance,
               u.user_failed_login_attempt AS failedLoginAttempt, u.user_last_login_time AS lastLoginTime,
               c.currency_country_id AS currencyId, c.currency_name AS currencyName, r.role_name AS roleName,
               u.creation_date AS signUpDate, r.role_status AS roleStatus,c.pgw_currency_iso_code AS pgwCurrencyCode,c.currency_conversion_rate AS currencyConvertionRate
        FROM platform_users AS u LEFT JOIN platform_users AS pu ON u.user_parent_id = pu.user_id
        JOIN platform_roles AS r ON u.user_role_id = r.role_id
        JOIN platform_currency AS c ON u.user_currency_id = c.currency_country_id
        WHERE u.user_id = ?`,
    incrementReferralCount: `
        UPDATE platform_users 
        SET user_referral_count = user_referral_count + 1, 
            updated_by = ?, 
            last_update_date = NOW() 
        WHERE user_id = ?`,
    updateUserReferredBy: `
        UPDATE platform_users 
        SET referred_by = ?,
        last_update_date = NOW() 
        WHERE user_id = ? and referred_by = 0`,
    updateAppUserInfoOnSignUp: `
        UPDATE platform_users 
        SET user_installation_source = ?, user_campaign_name = ? 
        WHERE user_id = ?
    `,
    checkUserMerchantEligibility: `
    select u1.user_id, u1.user_name, u1.user_role_id, u1.user_status,
    u1.user_parent_id, u1.referred_by, u1.security_deposit_amount,
    u2.user_name as referred_by_name,
    u2.user_role_id as referred_by_role,
    (select config_param_value from platform_configuration where config_param_name  = 'merchantSDProductId') as merchant_sd_product_id,
    crwtl.transfer_limit_from_role as limit_from_role,
    crwtl.transfer_limit_to_role as limit_to_role,
    crwtl.transfer_limit_amount_min as limit_min_amount,
    crwtl.transfer_limit_amount_max as limit_max_amount
    from platform_users u1
    left join platform_users u2 on u2.user_id = u1.referred_by and u1.referred_by > 0
    left join platform_role_wise_transfer_limit crwtl on u1.user_role_id = crwtl.transfer_limit_from_role and crwtl.transfer_limit_channel = 'sd'
    where u1.user_id = ? and u1.referred_by > 0 and u1.security_deposit_amount = 0 and u1.user_status = 'Active' and
    u1.user_role_id = crwtl.transfer_limit_from_role and
    ? >= crwtl.transfer_limit_amount_min  and ? <= crwtl.transfer_limit_amount_max and
    FIND_IN_SET(u2.user_role_id, (select config_param_value from platform_configuration where config_param_name  = 'migrateEligibleReferredByRole')) > 0
    `,
    checkUserMerchantEligibilityManually: `
    select u1.user_id, u1.user_name, u1.user_role_id, u1.user_status,
    u1.user_parent_id, u1.referred_by, u1.security_deposit_amount,
    u2.user_name as referred_by_name,
    u2.user_role_id as referred_by_role,
    (select config_param_value from platform_configuration where config_param_name  = 'merchantSDProductId') as merchant_sd_product_id,
    crwtl.transfer_limit_from_role as limit_from_role,
    8 as limit_to_role,
    crwtl.transfer_limit_amount_min as limit_min_amount,
    crwtl.transfer_limit_amount_max as limit_max_amount
    from platform_users u1
    left join platform_users u2 on u2.user_id = u1.referred_by
    left join platform_role_wise_transfer_limit crwtl on u1.user_role_id = crwtl.transfer_limit_from_role and crwtl.transfer_limit_channel = 'sd'
    where u1.user_id = ? and u1.security_deposit_amount = 0 and u1.user_status = 'Active' and
    u1.user_role_id = 8 and
    u1.user_balance >= (select product_value from platform_product_info cpi
    left join platform_configuration cc on cpi.product_id = cc.config_param_value and cc.config_param_name  = 'merchantSDProductId'
    where  cc.config_param_name  = 'merchantSDProductId') 
    `,
    getMigratedRoleUser: `
    select u1.user_id, u1.user_name, u1.user_role_id, u1.user_status,
    u1.user_parent_id, u1.referred_by, u1.security_deposit_amount,
    (select config_param_value from platform_configuration where config_param_name  = 'merchantSDProductId') as merchant_sd_product_id
    from platform_users u1
    where u1.user_id = ? and u1.security_deposit_amount = 0 and u1.user_status = 'Active'
    `,
    migrateUserToMerchant: `
        UPDATE platform_users 
        SET security_deposit_amount = ?,
        user_role_id = ?,
        last_update_date = NOW() 
        WHERE user_id = ?`,
    nearbyAgentSearchParams: `
        SELECT config_param_name AS name, config_param_value AS value 
        FROM platform_configuration 
        WHERE config_param_name IN ('maxRadiusForNearbyAgentSearch', 'maxAgentsForNearbyAgentSearch')
    `,
    nearbyAgents: function (latitude, longitude, radius, distanceUnit, maxNoOfAgents) {
        return `
        SELECT userId, username, fullName, mobileNo, latitude, longitude, distance
        FROM (
            SELECT u.user_id AS userId, u.user_name AS username, u.user_full_name AS fullName, 
                   u.user_latitude AS latitude, u.user_longitude AS longitude, CONCAT(u.user_country_code, u.user_mobileno) AS mobileNo, p.radius,
                   (ST_Distance_Sphere(point(u.user_longitude, u.user_latitude), point(${longitude}, ${latitude})) / 1000.0) AS distance
            FROM platform_users AS u
            JOIN (
                SELECT ${latitude} AS latpoint, ${longitude} AS longpoint,
                       ${radius} AS radius, ${distanceUnit} AS distance_unit
            ) AS p ON 1=1
            WHERE u.user_role_id IN (?) AND
                u.user_latitude
                BETWEEN p.latpoint - (p.radius / p.distance_unit)
                    AND p.latpoint + (p.radius / p.distance_unit)
                AND u.user_longitude
                        BETWEEN p.longpoint - (p.radius / (p.distance_unit * COS(RADIANS(p.latpoint))))
                        AND p.longpoint + (p.radius / (p.distance_unit * COS(RADIANS(p.latpoint))))
            ) AS d
        WHERE distance <= radius
        ORDER BY distance
        LIMIT ${maxNoOfAgents}
        `
    },
    usersRole: `
        SELECT u.user_id AS platformUserId, r.role_id AS roleId, r.role_name AS roleName 
        FROM platform_users AS u JOIN platform_roles AS r ON u.user_role_id = r.role_id
        WHERE u.user_id IN (?)
    `,
    createRefundRequest: `
        INSERT INTO platform_security_deposit_refund (user_id, request_reason, status, security_deposit_amount, create_date)
        SELECT * FROM (SELECT ?, ?, 'requested', ?, NOW()) AS tmp
        WHERE NOT EXISTS (
        SELECT user_id FROM platform_security_deposit_refund WHERE user_id = ? and status = 'requested' )
    `,
    updateRefundRequestApproval: `
        UPDATE platform_security_deposit_refund 
        SET approval_reject_by = ?,
        approval_reject_reason = ?,
        status = ?,
        approval_reject_date = NOW()
        WHERE id = ?`,
    specificUserInfoByUserId: `
        SELECT user_name, user_role_id, user_mobileno, user_balance, security_deposit_amount, user_status FROM platform_users WHERE user_id = ?
        and security_deposit_amount > 0
    `,
    getUserInfoByReferenceId: `
        SELECT user_id, security_deposit_amount FROM platform_security_deposit_refund WHERE id = ? and status = 'requested'
    `,
    checkStatus: `
        SELECT user_id, status FROM platform_security_deposit_refund 
        WHERE id = ? and status = 'approved'
    `,
    userSecurityDepositUpdate: `
        UPDATE platform_users 
        SET security_deposit_amount = 0,
        user_role_id = 7
        WHERE user_id = ?`,
    updatePhoneNumber: `
        UPDATE platform_users 
        SET previous_mobile_no = user_mobileno, 
        user_mobileno = ?,
        user_country_code = ?,
        is_mobile_updated = 1,
        last_update_date = NOW() 
        WHERE user_id = ?
    `,
    fetchUserPhoneWithCountryCode: `
        SELECT user_mobileno, user_country_code, user_name
        FROM platform_users 
        WHERE user_id = ?
    `,
    insertPhoneUpdateLog: `
        INSERT INTO platform_mobile_update_history
        (user_id, new_mobile_no, prev_mobile_no, created_by) 
        VALUES (?, ?, ?, ?)
    `,
    updateEmail: `
        UPDATE platform_users 
        SET previous_email = user_email, 
        user_email = ?,
        is_email_updated = 1,
        last_update_date = NOW() 
        WHERE user_id = ?
    `,
    refundUserHistory: `
    SELECT id, user_id, status, request_reason, approval_reject_by, approval_reject_reason,
    approval_reject_date, security_deposit_amount, create_date 
    FROM platform_security_deposit_refund 
    WHERE user_id = ?
    ORDER BY create_date DESC
    `,
    validateJompayIssue: `
    SELECT ppi.actual_transfer_id AS transfer_to,
       ppi.raised_by AS claimedById,
       ppi.issue_from as issueFrom,
       ppi.execution_enable_at as executionEnableAt,
       ppi.sales_order_id as salesOrderId,
       cso.sales_order_reference_id as jompayRef,
       cu.user_name as transfer_to_user_name,
       cu.user_role_id AS transfer_to_role,
       cu.user_currency_id AS transfer_to_currency,
       jcu.user_id AS transfer_from,
       jcu.user_role_id AS transfer_from_role,
       jcu.user_currency_id AS transfer_from_currency,
       cso.sales_order_user_id AS freezed_id,
       fu.user_role_id AS freezed_role,
       fu.user_currency_id AS freezed_currency,
       cso.sales_order_amount AS amount
    FROM partner_payment_issues ppi
    inner join platform_users cu ON ppi.actual_transfer_id = cu.user_id
    LEFT JOIN platform_users jcu ON jcu.user_id = 132493
    LEFT JOIN platform_sales_order cso ON ppi.sales_order_id = cso.sales_order_id
    LEFT JOIN platform_users fu ON cso.sales_order_user_id = fu.user_id
    WHERE ppi.id = ? AND ppi.status = 'pending';
    `,
    updateJompayIssue: `
    UPDATE partner_payment_issues
    SET approved_rejected_reason = ?,
    status = ?,
    approved_rejected_by_id = ?,
    approved_rejected_at = NOW()
    WHERE id = ?
    `,
    resellerList: function (filter) {
        return `
        SELECT u.user_id AS userId, u.user_name AS username, u.user_full_name AS fullName, u.user_pwd_expiry AS passwordExpiryDate, u.user_role_id AS roleId,
               r.role_name AS roleName, r.role_level AS roleLevel, u.user_status AS status, u.user_parent_id AS parentId, u.user_contact_id AS contactId, 
               u.user_email AS email, u.user_country_code AS countryCode, u.user_mobileno AS mobileNo, u.user_currency_id AS currencyId,  
               u.user_profile_pic AS profilePicture, u.user_balance AS balance, u.user_last_login_time AS lastLoginTime
        FROM platform_users AS u JOIN platform_roles AS r ON u.user_role_id = r.role_id
        WHERE u.user_parent_id = ?${filter}
        ORDER BY u.user_id ASC
    `
    },
	
    retrieveUserInfoByPhone: `SELECT user_name AS userName, user_id AS userId, user_email AS email, user_device_registration_email_authentication AS deviceEmailAuthentication , user_forget_password_email_authentication AS forgetPasswordEmailAuthentication FROM platform_users WHERE user_mobileno=? LIMIT 1`,

    addUserEmail: `
    UPDATE platform_users 
    SET user_email = user_email, 
    is_email_updated = 1,
    user_email = ?,
    last_update_date = NOW() 
    WHERE user_id = ?
    `,
    checkUserEmail: `SELECT * FROM platform_users where user_email = ? and user_id = ? `,
    checkUserPassword: `SELECT * FROM platform_users where user_pwd= ? `,
    updateUserEmail: `
    UPDATE platform_users 
        SET previous_email = ?, user_email = ?,
        is_email_updated = 1,
        last_update_date = NOW() 
        WHERE user_id = ?
    `,
    checkPlatformUserStatus: `SELECT user_status FROM platform_users  WHERE user_id = ? `
}
