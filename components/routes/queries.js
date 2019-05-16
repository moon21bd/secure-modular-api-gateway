'use strict';

module.exports = {
    insertRoute: `
        INSERT INTO platform_routes(route_name, route_status, route_address_line_1, route_address_line_2, route_address_line_3, route_city, route_zip_postcode, route_state_province_county, route_country, route_other_details, created_by)
        VALUES(?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    updateRoute: `
        UPDATE platform_routes 
            SET route_name = IF(? IS NULL, route_name, ?),
                route_status = IF(? IS NULL, route_status, ?),
                route_address_line_1 = IF(? IS NULL, route_address_line_1, ?),
                route_address_line_2 = IF(? IS NULL, route_address_line_2, ?),
                route_address_line_3 = IF(? IS NULL, route_address_line_3, ?),
                route_city = IF(? IS NULL, route_city, ?),
                route_zip_postcode = IF(? IS NULL, route_zip_postcode, ?),
                route_state_province_county = IF(? IS NULL, route_state_province_county, ?),
                route_country = IF(? IS NULL, route_country, ?),
                route_other_details = IF(? IS NULL, route_other_details, ?),
                updated_by = ?
        WHERE route_id = ?
    `,
    fetchSpecificRoute: `
        SELECT route_id AS routeId, route_name AS name, route_status AS status, route_address_line_1 AS addressLine1, route_address_line_2 AS addressLine2,
               route_address_line_3 AS addressLine3, route_city AS city, route_zip_postcode AS zipCode,
               route_state_province_county AS state, route_country AS country, route_other_details AS otherDetails,
               created_by AS createdBy, updated_by AS updatedBy, creation_date AS createdAt, last_update_date As updatedAt
        FROM platform_routes
        WHERE route_id = ?
    `,
    fetchAllRoutes: `
        SELECT route_id AS routeId, route_name AS name, route_status AS status, route_address_line_1 AS addressLine1, route_address_line_2 AS addressLine2,
               route_address_line_3 AS addressLine3, route_city AS city, route_zip_postcode AS zipCode,
               route_state_province_county AS state, route_country AS country, route_other_details AS otherDetails,
               created_by AS createdBy, updated_by AS updatedBy, creation_date AS createdAt, last_update_date As updatedAt
        FROM platform_routes
    `,
    isDefaultRoute: `
        SELECT 1 AS defaultRoute FROM platform_configuration 
        WHERE config_param_name = 'defaultRouteId' AND config_param_value = ?
    `
};