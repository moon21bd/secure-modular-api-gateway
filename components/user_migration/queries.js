'use strict';

module.exports = {
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
	migrateUserToMerchant: `
        UPDATE platform_users 
        SET security_deposit_amount = ?,
        user_role_id = ?,
        last_update_date = NOW() 
        WHERE user_id = ?`,
	getMigratedRoleUser: `
    select u1.user_id, u1.user_name, u1.user_role_id, u1.user_status,
    u1.user_parent_id, u1.referred_by, u1.security_deposit_amount,
    (select config_param_value from platform_configuration where config_param_name  = 'merchantSDProductId') as merchant_sd_product_id
    from platform_users u1
    where u1.user_id = ? and u1.security_deposit_amount = 0 and u1.user_status = 'Active'
    `,
};
