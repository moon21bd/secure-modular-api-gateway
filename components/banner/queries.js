'use strict';

module.exports = {
    createBanner: `
        INSERT INTO platform_banner(
            banner_type, banner_title, banner_subtitle, banner_description, banner_image, banner_deep_link, 
            banner_role_id, banner_nationality, banner_channel, created_by, creation_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `,
    updateBanner: `
        UPDATE platform_banner
        SET banner_type = IF (? IS NULL, banner_type, ?),
            banner_title = IF (? IS NULL, banner_title, ?),
            banner_subtitle = IF (? IS NULL, banner_subtitle, ?),
            banner_description = IF (? IS NULL, banner_description, ?),
            banner_status = IF(? IS NULL, banner_status, ?),
            banner_image = IF (? IS NULL, banner_image, ?),
            banner_deep_link = IF (? IS NULL, banner_deep_link, ?),
            banner_role_id = IF (? IS NULL, banner_role_id, ?),
            banner_nationality = IF (? IS NULL, banner_nationality, ?),
            banner_channel = IF (? IS NULL, banner_channel, ?),
            updated_by = ?
        where banner_id = ?
    `,
    bannerListWithFilters: function (whereCondition) {
        return `
            SELECT banner_id AS id, banner_type AS type, banner_title AS title, banner_subtitle AS subtitle, 
                   banner_description AS description, banner_status AS status, banner_image AS image, 
                   banner_deep_link AS deepLink, banner_role_id AS roleId, banner_nationality AS nationality, banner_channel AS channel
            FROM platform_banner
            ${whereCondition}
        `
    },
    bannerList: `
        SELECT banner_id AS id, banner_type AS type, banner_title AS title, banner_subtitle AS subtitle, 
               banner_description AS des, banner_image AS media_url, banner_deep_link AS onclick
        FROM platform_banner
        WHERE (banner_role_id = 0 OR find_in_set(?, banner_role_id))
        AND (banner_nationality = 'NA' OR banner_nationality = ?) 
        AND (banner_channel = 'NA' OR banner_channel = ?)
        AND banner_status = 1
        ORDER BY banner_priority asc, creation_date desc
    `
};
