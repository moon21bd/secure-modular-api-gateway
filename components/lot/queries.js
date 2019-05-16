'use strict';

const MAX_DATETIME = '2038-01-01 00:00:00';

module.exports = {
    insertLotInfo: `
        INSERT INTO platform_lot(lot_id, lot_name, lot_product_id, lot_package_id, lot_no_of_cards, lot_card_value, lot_sales_value, lot_active_value_type, lot_card_currency, lot_status, lot_expiry_date, created_by)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, 2, IF ('${MAX_DATETIME}' < DATE_ADD(NOW(), INTERVAL ? DAY), '${MAX_DATETIME}', DATE_ADD(NOW(), INTERVAL ? DAY)), ?)
    `,
    insertLotAddOn: `
        INSERT INTO platform_lot_products(lot_id, product_id, package_id, created_by) VALUES ?
        ON DUPLICATE KEY
        UPDATE lot_products_status = 1,
               updated_by = ?
    `,
    fetchOnlyLotInfo: `
        SELECT l.lot_id AS lotId, l.lot_product_id AS productId, l.lot_package_id AS packageId, l.lot_no_of_cards AS noOfCards,
               l.lot_card_value AS cardValue, l.lot_sales_value AS salesValue, l.lot_active_value_type AS activeValueType, 
               l.lot_card_currency AS currencyId, lot_status AS \`status\`, l.lot_expiry_date AS expiryDate
        FROM platform_lot AS l
        WHERE l.lot_id = ? AND l.lot_expiry_date > NOW()
    `,
    fetchSpecificLot: `
        SELECT l.lot_id AS lotId, l.lot_name AS lotName, l.lot_product_id AS productId, l.lot_package_id AS packageId, 
               pi.product_name AS productName, p.package_name AS packageName,
               IFNULL (lpl.provision_log_start_serial_no, 'NA') AS startSerialNo, l.lot_no_of_cards AS noOfCards, 
               l.lot_card_value AS cardValue, l.lot_sales_value AS salesValue, l.lot_active_value_type AS activeValueType, 
               l.lot_card_currency AS currencyId, c.currency_name AS currencyName,
               CASE lot_status
               WHEN 1 THEN 'Provisioned'
               WHEN 2 THEN 'Free'
               ELSE 'Inactive'
               END AS \`status\`, l.lot_expiry_date AS expiryDate, l.created_by AS createdBy, l.updated_by AS updatedBy,
               l.creation_date AS createdAt, l.last_update_date AS updatedAt,
               GROUP_CONCAT(IF(lp.product_id IS NOT NULL, 
                   CONCAT(ipi.product_id, '$', ipi.product_name, '$', ipc.category_name, '$', ipi.product_value, '$', ic.currency_name, '$', ipi.product_sales_value, '$', 0), 
                   CONCAT(pppi.product_id, '$', pppi.product_name, '$', pppc.category_name, '$', pppi.product_value, '$', ppc.currency_name, '$', pppi.product_sales_value, '$', pp.package_id)
               ) SEPARATOR '||') AS addOnList
        FROM platform_lot AS l
        JOIN platform_currency AS c ON l.lot_card_currency = c.currency_country_id
        LEFT JOIN platform_product_info AS pi ON l.lot_product_id = pi.product_id
        LEFT JOIN platform_package AS p ON l.lot_package_id = p.package_id
        LEFT JOIN platform_lot_products AS lp ON l.lot_id = lp.lot_id
           LEFT JOIN platform_product_info AS ipi ON lp.product_id = ipi.product_id
               LEFT JOIN platform_product_category AS ipc ON ipi.product_category_id = ipc.category_id
               LEFT JOIN platform_currency AS ic ON ipi.product_currency_id = ic.currency_country_id
           LEFT JOIN platform_package AS ip ON lp.package_id = ip.package_id
               LEFT JOIN platform_package_products AS pp ON lp.package_id = pp.package_id AND pp.package_products_status = 1
                   LEFT JOIN platform_product_info AS pppi ON pp.product_id = pppi.product_id
                       LEFT JOIN platform_product_category AS pppc ON pppi.product_category_id = pppc.category_id
                       LEFT JOIN platform_currency AS ppc ON pppi.product_currency_id = ppc.currency_country_id
        LEFT JOIN platform_lot_provision_log AS lpl ON l.lot_id = lpl.provision_log_lot_id
        WHERE l.lot_id = ? AND l.lot_status != 0 AND (lp.lot_products_status IS NULL OR lp.lot_products_status = 1)
        GROUP BY l.lot_id
    `,
    fetchAllLot: `
        SELECT l.lot_id AS lotId, l.lot_name AS lotName, l.lot_product_id AS productId, l.lot_package_id AS packageId, 
               IFNULL (lpl.provision_log_start_serial_no, 'NA') AS startSerialNo, l.lot_no_of_cards AS noOfCards, 
               l.lot_card_value AS cardValue, l.lot_sales_value AS salesValue, l.lot_active_value_type AS activeValueType,
               l.lot_card_currency AS currencyId,
               CASE lot_status
                   WHEN 1 THEN 'Provisioned'
                   WHEN 2 THEN 'Free'
                   ELSE 'Inactive'
               END AS \`status\`, l.lot_expiry_date AS expiryDate, l.created_by AS createdBy, l.updated_by AS updatedBy,
               l.creation_date AS createdAt, l.last_update_date AS updatedAt,
               GROUP_CONCAT(CONCAT(IFNULL(lp.product_id, 0), '.', IFNULL(lp.package_id, 0))) AS addOnList
        FROM platform_lot AS l
        LEFT JOIN platform_lot_products AS lp ON l.lot_id = lp.lot_id
        LEFT JOIN platform_lot_provision_log as lpl on l.lot_id = lpl.provision_log_lot_id
        WHERE l.creation_date >= ? AND l.creation_date <= ? AND l.lot_status != 0
        AND (lp.lot_products_status IS NULL OR lp.lot_products_status = 1)
        GROUP BY l.lot_id
    `,
    verifyLotId: `
        SELECT lot_status AS lotStatus FROM platform_lot WHERE lot_id = ? AND lot_status != 0
    `,
    verifyIfLotIsInProvisioningState: `
        SELECT provision_log_status AS logStatus FROM platform_lot_provision_log WHERE provision_log_lot_id = ?
    `,
    updateLotInfo: `
        UPDATE platform_lot SET 
                       lot_name = IF(? IS NULL, lot_name, ?),
                       lot_product_id = IF(? IS NULL, lot_product_id, ?),
                       lot_package_id = IF(? IS NULL, lot_package_id, ?),
                       lot_no_of_cards = IF(? IS NULL, lot_no_of_cards, ?),
                       lot_card_value = IF(? IS NULL, lot_card_value, ?),
                       lot_sales_value = IF(? IS NULL, lot_sales_value, ?),
                       lot_active_value_type = IF(? IS NULL, lot_active_value_type, ?),
                       lot_card_currency = IF(? IS NULL, lot_card_currency, ?),
                       lot_status = IF(? IS NULL, lot_status, ?),
                       lot_expiry_date = IF(? IS NULL, lot_expiry_date, IF ('${MAX_DATETIME}' < DATE_ADD(NOW(), INTERVAL ? DAY), '${MAX_DATETIME}', DATE_ADD(NOW(), INTERVAL ? DAY))),
                       updated_by = ?
       WHERE lot_id = ? AND ((lot_product_id IS NULL AND ? IS NULL) OR (lot_package_id IS NULL AND ? IS NULL))
    `,
    deleteLotAddOn: `
        UPDATE platform_lot_products SET lot_products_status = 0 WHERE lot_id = ? AND (product_id IN (?) OR package_id IN (?))
    `,
    updateCardsUnderSpecificLot: `
        UPDATE platform_card 
        SET card_value = IF(? IS NULL, card_value, ?),
            card_sales_value = IF(? IS NULL, card_sales_value, ?),
            card_active_value_type = IF(? IS NULL, card_active_value_type, ?),
            card_expiry_date = IF(? IS NULL, card_expiry_date, IF ('${MAX_DATETIME}' < DATE_ADD(NOW(), INTERVAL ? DAY), '${MAX_DATETIME}', DATE_ADD(NOW(), INTERVAL ? DAY))),
            updated_by = ?
        WHERE card_lot_id = ? AND card_status != 2                
    `,
    checkProvisionLot: 'CALL platform_check_provision_lot(?)',
    provisionLot: `
        CREATE EVENT provision_lot_event_?_?
          ON SCHEDULE
          AT CURRENT_TIMESTAMP
          ON COMPLETION NOT PRESERVE
          ENABLE
          DO
            CALL platform_provision_lot(?, ?, ?)
    `,
    lotProvisionStatus: `
        SELECT provision_log_start_serial_no AS startSerialNo, provision_log_max_serial_no AS endSerialNo,
               CASE provision_log_status
                   WHEN 0 THEN 'Initiated'
                   WHEN 1 THEN 'Finished'
                   WHEN 2 THEN 'Processing'
                   WHEN 3 THEN 'Rejected'
                   ELSE 'Invalid'
               END AS status, provision_log_error_occurred AS error,
               provision_log_error_message AS errorMessage
        FROM platform_lot_provision_log 
        WHERE provision_log_lot_id = ? ORDER BY creation_date DESC LIMIT 1
    `,
    lotDetailInfo: function (cardLimitClause, lotLimitClause, purpose) {
        let cardStatusCondition = (purpose === 2) ? 'card_status != 2' : 'card_status = ?';
        let condForTransferredCard = (purpose === 2) ? 'AND card_assigned_to IS NULL' : '';

        if (purpose === 3) {
            cardStatusCondition = '1 = 1';
            condForTransferredCard = '';
        }

        let prefix = `
            SELECT l.lot_id AS lotId, c.currency_name AS currencyName, IFNULL (temp.start_serial_no, 'NA') AS startSerial, IFNULL(temp.end_serial_no, 'NA') AS endSerial, 
                   IF (temp.noOfCards = -1, l.lot_no_of_cards, temp.noOfCards) AS noOfCards, IF (l.lot_product_id IS NULL, 1, 0) AS isPackage, 
                   IF (l.lot_product_id IS NULL, p.package_name, pi.product_name) AS \`name\`, l.lot_active_value_type AS activeValueType,
                   IF (l.lot_active_value_type = 0, l.lot_sales_value, IF (l.lot_active_value_type = 1, pi.product_sales_value, p.package_sales_value)) AS cardSalesValue,
                   IF (l.lot_active_value_type = 0, l.lot_card_value, IF (l.lot_active_value_type = 1, pi.product_value, -1)) AS cardValue,
                   GROUP_CONCAT(DISTINCT IF (lp.package_id IS NULL, CONCAT(0, '.', ipi.product_id, '.', ipi.product_name), CONCAT(1, '.', ip.package_id, '.', ip.package_name)) SEPARATOR '$') AS addOns,
                   GROUP_CONCAT(DISTINCT CONCAT(pppi.product_name, '|', pppi.product_value)) AS lotValues
            FROM platform_lot AS l JOIN platform_currency AS c ON l.lot_card_currency = c.currency_country_id`;

        let joinType = (purpose !== 1) ? 'JOIN' : 'LEFT JOIN';

        let filtering = (purpose === 0 || purpose === 2 || purpose === 3) ?
            `
                (
                    SELECT card_lot_id, MAX(flag) AS start_serial_no, IF (MAX(expected) > MAX(flag), MAX(expected), MAX(flag)) AS end_serial_no, COUNT(*) AS noOfCards
                    FROM (
                    SELECT
                    @rownum:=@rownum + 1 AS expected,
                    IF (@rownum = card_serial_no, @groupnum, @groupnum := @groupnum + 1) AS groupnum,
                    IF (@rownum = card_serial_no, (IF (@lotid = card_lot_id, 0, card_serial_no)), @rownum := card_serial_no) AS flag, 
                    @lotid:=card_lot_id AS card_lot_id
                    FROM
                    (SELECT @rownum := 0, @groupnum := 1, @lotid := 1) AS a
                    JOIN platform_card
                    WHERE card_serial_no >= ? AND ${cardStatusCondition}
                    AND (? IS NULL OR card_lot_id = ?)
                    ${condForTransferredCard}
                    ORDER BY card_serial_no
                        ${cardLimitClause}
                    ) AS z
                    GROUP BY z.groupnum, z.card_lot_id
                )
            `
            :
            `
                (
                    SELECT provision_log_lot_id AS card_lot_id, provision_log_start_serial_no AS start_serial_no, provision_log_max_serial_no AS end_serial_no, -1 AS noOfCards
                    FROM platform_lot_provision_log AS t1
                    INNER JOIN (
                        SELECT MAX(provision_log_id) AS max_provision_log_id 
                        FROM platform_lot_provision_log 
                        WHERE provision_log_error_occurred = 0 
                        GROUP BY provision_log_lot_id
                    ) AS t2
                    ON t1.provision_log_id = t2.max_provision_log_id
                )
            `;

        let suffix = `temp ON l.lot_id = temp.card_lot_id
            LEFT JOIN platform_lot_products AS lp 
                LEFT JOIN platform_product_info AS ipi ON lp.product_id = ipi.product_id
                LEFT JOIN platform_package AS ip ON lp.package_id = ip.package_id
            ON l.lot_id = lp.lot_id
            LEFT JOIN platform_product_info AS \`pi\` ON l.lot_product_id = \`pi\`.product_id
            LEFT JOIN platform_package AS p ON l.lot_package_id = p.package_id
            LEFT JOIN platform_package_products AS pp
                INNER JOIN platform_product_info AS pppi ON pp.product_id = pppi.product_id
            ON l.lot_package_id = pp.package_id
            WHERE (lp.lot_products_status IS NULL or lp.lot_products_status = 1)
            GROUP BY l.lot_id, temp.start_serial_no, temp.end_serial_no
            ${lotLimitClause}
        `;
        return `${prefix} ${joinType} ${filtering} ${suffix}`;
    },
    updatableCards: `
        SELECT SUM(CASE WHEN card_status = 2 THEN 1 ELSE 0 END) AS nonUpdatableCards, SUM(CASE WHEN card_status != 2 THEN 1 ELSE 0 END) AS updatableCards
        FROM platform_card
        WHERE card_lot_id = ?              
    `,
    lotDetailInfoForSalesPortal: function (cardLimitClause, lotLimitClause, purpose) {
        let cardStatusCondition = (purpose === 2) ? 'card_status != 2' : 'card_status = ?';
        let condForTransferredCard = (purpose === 2) ? 'AND card_assigned_to = ? ' : '';

        if (purpose === 3) {
            cardStatusCondition = '1 = 1';
            condForTransferredCard = '';
        }

        let prefix = `
            SELECT l.lot_id AS lotId, c.currency_name AS currencyName, IFNULL (temp.start_serial_no, 'NA') AS startSerial, IFNULL(temp.end_serial_no, 'NA') AS endSerial, 
                   IF (temp.noOfCards = -1, l.lot_no_of_cards, temp.noOfCards) AS noOfCards, IF (l.lot_product_id IS NULL, 1, 0) AS isPackage, 
                   IF (l.lot_product_id IS NULL, p.package_name, pi.product_name) AS \`name\`, l.lot_active_value_type AS activeValueType,
                   spi.product_sales_value AS cardSalesValue, IF (l.lot_active_value_type = 0, l.lot_card_value, IF (l.lot_active_value_type = 1, pi.product_value, -1)) AS cardValue,
                   GROUP_CONCAT(DISTINCT IF (lp.package_id IS NULL, CONCAT(0, '.', ipi.product_id, '.', ipi.product_name), CONCAT(1, '.', ip.package_id, '.', ip.package_name)) SEPARATOR '$') AS addOns,
                   GROUP_CONCAT(DISTINCT CONCAT(pppi.product_name, '|', pppi.product_value)) AS lotValues
            FROM platform_lot AS l JOIN platform_currency AS c ON l.lot_card_currency = c.currency_country_id`;

        let joinType = (purpose !== 1) ? 'JOIN' : 'LEFT JOIN';

        let filtering = (purpose === 0 || purpose === 2 || purpose === 3) ?
            `
                (
                    SELECT card_lot_id, card_sales_product_id, MAX(flag) AS start_serial_no, IF (MAX(expected) > MAX(flag), MAX(expected), MAX(flag)) AS end_serial_no, COUNT(*) AS noOfCards
                    FROM (
                    SELECT
                    @rownum:=@rownum + 1 AS expected,
                    IF (@rownum = card_serial_no, @groupnum, @groupnum := @groupnum + 1) AS groupnum,
                    IF (@rownum = card_serial_no, (IF (@lotid = card_lot_id, 0, card_serial_no)), @rownum := card_serial_no) AS flag, 
                    @lotid:=card_lot_id AS card_lot_id, card_sales_product_id
                    FROM
                    (SELECT @rownum := 0, @groupnum := 1, @lotid := 1) AS a
                    JOIN platform_card
                    WHERE card_serial_no >= ? AND ${cardStatusCondition}
                    AND card_sales_product_id = ?
                    ${condForTransferredCard}
                    ORDER BY card_serial_no
                        ${cardLimitClause}
                    ) AS z
                    GROUP BY z.groupnum, z.card_lot_id
                )
            `
            :
            `
                (
                    SELECT provision_log_lot_id AS card_lot_id, provision_log_start_serial_no AS start_serial_no, provision_log_max_serial_no AS end_serial_no, -1 AS noOfCards
                    FROM platform_lot_provision_log AS t1
                    INNER JOIN (
                        SELECT MAX(provision_log_id) AS max_provision_log_id 
                        FROM platform_lot_provision_log 
                        WHERE provision_log_error_occurred = 0 
                        GROUP BY provision_log_lot_id
                    ) AS t2
                    ON t1.provision_log_id = t2.max_provision_log_id
                )
            `;

        let suffix = `temp ON l.lot_id = temp.card_lot_id
            LEFT JOIN platform_lot_products AS lp 
                LEFT JOIN platform_product_info AS ipi ON lp.product_id = ipi.product_id
                LEFT JOIN platform_package AS ip ON lp.package_id = ip.package_id
            ON l.lot_id = lp.lot_id
            LEFT JOIN platform_product_info AS \`pi\` ON l.lot_product_id = \`pi\`.product_id
            LEFT JOIN platform_product_info AS \`spi\` ON temp.card_sales_product_id = \`spi\`.product_id
            LEFT JOIN platform_package AS p ON l.lot_package_id = p.package_id
            LEFT JOIN platform_package_products AS pp
                INNER JOIN platform_product_info AS pppi ON pp.product_id = pppi.product_id
            ON l.lot_package_id = pp.package_id
            WHERE (lp.lot_products_status IS NULL or lp.lot_products_status = 1)
            GROUP BY l.lot_id, temp.start_serial_no, temp.end_serial_no
            ${lotLimitClause}
        `;
        return `${prefix} ${joinType} ${filtering} ${suffix}`;
    },

};
