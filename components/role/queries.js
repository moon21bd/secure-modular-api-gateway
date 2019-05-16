'use strict';

module.exports = {
    checkIfRoleIdExists: `
        SELECT role_level AS level FROM platform_roles WHERE role_id = ? AND role_status = 1
    `,
    checkRoleLevel: `
        SELECT (r.role_level < ?) AS isAuthorized 
        FROM platform_users AS u JOIN platform_roles AS r ON u.user_role_id = r.role_id
        WHERE u.user_id = ? 
    `,
    checkIfRoleExists: `
        SELECT 1 AS isExists FROM platform_roles WHERE role_name = ?
    `,
    createRole:`
        INSERT INTO platform_roles(role_name, role_description, role_level, role_menu_permission, role_allow_sales, created_by)
        VALUES(?, ?, ?, ?, ?, ?)
    `,
    fetchSpecificRole: `
        SELECT role_id as id, role_name as \`name\`, role_description as description, role_level as level, role_menu_permission as menuPermission, role_status AS status, role_allow_sales AS allowSales, created_by as createdBy, updated_by as updatedBy, creation_date as createdAt, last_update_date as updatedAt
        FROM platform_roles
        WHERE role_id = ? AND role_level >= (SELECT r.role_level FROM platform_users AS u JOIN platform_roles AS r ON u.user_role_id = r.role_id WHERE u.user_id = ?)
    `,
    fetchAllRoles: `
        SELECT role_id as id, role_name as \`name\`, role_description as description, role_level as level, role_menu_permission as menuPermission, role_status AS status, role_allow_sales AS allowSales, created_by as createdBy, updated_by as updatedBy, creation_date as createdAt, last_update_date as updatedAt
        FROM platform_roles
        WHERE role_level >= (SELECT r.role_level FROM platform_users AS u JOIN platform_roles AS r ON u.user_role_id = r.role_id WHERE u.user_id = ?)
    `,
    updateRole:`
        UPDATE platform_roles
        SET role_name = IF(? = '', role_name, ?),
            role_description = IF(? = '', role_description, ?),
            role_level = IF(? = -1, role_level, ?),
            role_menu_permission = IF(? = '', role_menu_permission, ?),
            role_status = IF(? = -1, role_status, ?),
            role_allow_sales = IF(? IS NULL, role_allow_sales, ?),
            updated_by = ?,
            last_update_date = NOW()
        WHERE role_id = ?
    `,
    createRoleSetting: `
        INSERT INTO platform_role_setting(role_id, role_setting_allowed_user_type, role_setting_allow_all_status, role_setting_allow_all_role, role_setting_allow_all_route, role_settings_allow_product_execution_update, created_by)
        VALUES(?, 0, 0, 0, 0, 0, ?)
    `,
    fetchSpecificRoleSetting: `
        SELECT role_setting_allowed_user_type AS allowedUserType, role_setting_allow_all_status AS allowAllStatus, 
               role_setting_allow_all_role AS allowAllRole, role_setting_allow_all_route AS allowAllRoute, 
               role_settings_allow_product_execution_update AS allowProductExecutionUpdate
        FROM platform_role_setting
        WHERE role_id = ?
    `,
    updateRoleSetting:`
        UPDATE platform_role_setting
        SET role_setting_allowed_user_type = IF(? IS NULL, role_setting_allowed_user_type, ?),
            role_setting_allow_all_status = IF(? IS NULL, role_setting_allow_all_status, ?),
            role_setting_allow_all_role = IF(? IS NULL, role_setting_allow_all_role, ?),
            role_setting_allow_all_route = IF(? IS NULL, role_setting_allow_all_route, ?),
            role_settings_allow_product_execution_update = IF(? IS NULL, role_settings_allow_product_execution_update, ?),
            updated_by = ?
        WHERE role_id = ?
    `,
    fetchRolePermission: function (whereCondition) {
        return `SELECT role_permission_id AS rolePermissionId, role_permission_status AS status, 
             role_permission_priority AS priority, role_permission_role_id AS roleId, 
             role_permission_action_type AS actionType, role_permission_resource AS resource, 
             role_permission_resource_attrib AS attributes, role_permission_condition AS context, 
             created_by AS createdBy, updated_by AS updatedBy, creation_date AS createdAt, last_update_date AS updatedAt
         FROM platform_role_permission
         ${whereCondition}
         ORDER BY role_permission_priority ASC, role_permission_id ASC`;
    }
};