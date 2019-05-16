'use strict';

module.exports = {
    createConfiguration: `
        INSERT INTO platform_configuration(config_param_type, config_param_name, config_param_description, config_param_value, config_iseditable, config_isviewable, created_by)
        VALUES(?, ?, ?, ?, IF(? = 1, 'Yes', 'No'), IF(? = 1, 'Yes', 'No'), ?)
    `,
    updateConfiguration: `
        UPDATE platform_configuration 
        SET config_param_type = IF(? IS NULL, config_param_type, ?),
            config_param_name = IF(? IS NULL, config_param_name, ?),
            config_param_description = IF(? IS NULL, config_param_description, ?),
            config_param_value = IF(? IS NULL, config_param_value, ?),
            config_iseditable = IF(? IS NULL, config_iseditable, IF(? = 1, 'Yes', 'No')),
            config_isviewable = IF(? IS NULL, config_isviewable, IF(? = 1, 'Yes', 'No')),
            updated_by = ?
        WHERE config_param_id = ? AND config_iseditable = 'Yes'
    `,
    showConfiguration: function (whereCondition) {
        return `
            SELECT config_param_id AS configId, config_param_name AS configName, config_param_description AS configDescription,
                   config_param_value AS configValue, IF(config_iseditable = 'Yes', 1, 0) AS isConfigEditable, created_by AS createdBy,
                   updated_by AS updatedBy, creation_date AS createdAt, last_update_date AS updatedAt
            FROM platform_configuration
            ${whereCondition}
        `;
    }
};