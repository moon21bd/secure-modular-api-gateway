'use strict';

module.exports = {
    cardInfo: `
        SELECT c.card_serial_no AS serialNo, c.card_lot_id AS lotId, platform_decrypt_hrn(c.card_hrn, '') AS pin, c.card_product_id AS productId, c.card_package_id AS packageId,  
               c.card_value AS amount, c.card_sales_value AS salesAmount, c.card_active_value_type AS activeValueType, c.card_currency_id AS currencyId,
               c.card_status AS status, c.card_expiry_date AS expiryDate, c.card_assigned_to AS assignedTo, 
               c.card_order_by AS orderBy, c.card_order_date AS orderDate, cu.currency_name AS currencyName
        FROM platform_card AS c
        JOIN (SELECT platform_encrypt_hrn(?, '') AS card_hrn) AS temp ON c.card_hrn = temp.card_hrn
        JOIN platform_currency AS cu ON card_currency_id = cu.currency_country_id
        WHERE cu.currency_status = 1
    `,
    retrieveAllProductIdAgainstALot: `SELECT package_id AS packageId, product_id AS productId FROM platform_lot_products WHERE lot_id = ? AND lot_products_status = 1 `,
    cardInfoWithPromo: `
        SELECT c.card_serial_no AS serialNo, c.card_lot_id AS lotId, platform_decrypt_hrn(c.card_hrn, '') AS pin, c.card_product_id AS productId, c.card_package_id AS packageId,  
               c.card_value AS amount, c.card_sales_value AS salesAmount, c.card_active_value_type AS activeValueType, c.card_currency_id AS currencyId,
               c.card_status AS status, c.card_expiry_date AS expiryDate, c.card_assigned_to AS assignedTo, 
               c.card_order_by AS orderBy, c.card_order_date AS orderDate, cu.currency_name AS currencyName,
               p.promo_id AS promoId, p.promo_type AS promoType, p.promo_text AS promoText, p.promo_masking_text AS promoMaskingText, 
               p.promo_start_time AS promoStartTime, p.promo_end_time AS promoEndTime
        FROM platform_card AS c
        JOIN (SELECT platform_encrypt_hrn(?, '') AS card_hrn) AS temp ON c.card_hrn = temp.card_hrn
        JOIN platform_currency AS cu ON card_currency_id = cu.currency_country_id
        JOIN platform_lot AS l ON c.card_lot_id = l.lot_id
        LEFT JOIN platform_promo AS p ON l.lot_promo_id = p.promo_id
        WHERE cu.currency_status = 1
    `,
    cardInfoUsingSerialNo: `
        SELECT c.card_serial_no AS serialNo, c.card_lot_id AS lotId, platform_decrypt_hrn(c.card_hrn, '') AS pin, c.card_product_id AS productId, c.card_package_id AS packageId, 
               c.card_value AS amount, c.card_sales_value AS salesAmount, c.card_active_value_type AS activeValueType, c.card_currency_id AS currencyId,
               c.card_status AS status, c.card_expiry_date AS expiryDate, c.card_assigned_to AS assignedTo, 
               c.card_order_by AS orderBy, c.card_order_date AS orderDate, cu.currency_name AS currencyName
        FROM platform_card AS c
        JOIN platform_currency AS cu ON c.card_currency_id = cu.currency_country_id
        WHERE c.card_serial_no = ? AND cu.currency_status = 1
    `,
    cardInfoForImpact: `
        SELECT c.card_serial_no AS serialNo, platform_decrypt_hrn(c.card_hrn, '') AS pin, c.card_expiry_date AS expiryDate, c.reference AS reference
        FROM platform_card AS c 
        WHERE c.card_assigned_to = ? AND c.card_product_id = ? AND c.card_status = 1
        LIMIT 1 FOR UPDATE
    `,
    cardStatisticForImpact: `
        SELECT cc.card_product_id as productId, cp.product_name as productName, count(*) as noOfCards
        FROM platform_card as cc
        LEFT JOIN platform_product_info as cp ON cc.card_product_id = cp.product_id
        WHERE cc.card_status = 1 AND cc.card_assigned_to = ? 
        GROUP BY cc.card_product_id
    `,

    updateCardInfo: `
        UPDATE platform_card SET card_status = ?, card_channel = ?, card_order_by = ?, card_order_date = NOW(), updated_by = ?, last_update_date = NOW()
        WHERE card_serial_no = ? AND card_status = 1
    `,
    deleteCardInfo: `
        DELETE FROM platform_card WHERE card_serial_no = ?
    `,
    redoCardInfo: `
        UPDATE platform_card SET card_status = ?, card_channel = (NULL), card_order_by = (NULL), card_order_date = (NULL), updated_by = ?, last_update_date = NOW()
        WHERE card_serial_no = ?
    `,
    redoCardStatus: `
        UPDATE platform_card SET card_status = ?, updated_by = ?, last_update_date = NOW() WHERE card_serial_no = ?
    `,
    onDemandCard: `CALL platform_generate_on_demand_card(?, ?, ?, ?, ?)`,
    changeStatus: `
        UPDATE platform_card SET card_status = ?, updated_by = ?
        WHERE card_serial_no >= ? AND card_serial_no <= ? AND card_status = ?
    `,
    transferCardsOwnership: `
        UPDATE platform_card SET card_assigned_to = ?, card_assigned_by = ?, card_assigned_date = NOW(), updated_by = ?
        WHERE card_serial_no >= ? AND card_serial_no <= ?
    `,
    setCardOwnershipTransferRecord: `
        INSERT INTO platform_card_ownership_transfer(
            card_ownership_transfer_type, card_ownership_transfer_from, card_ownership_transfer_to, 
            card_start_serial_no, card_ownership_transfer_quantity, card_ownership_transfer_status, created_by
        ) VALUES(?, ?, ?, ?, ?, 2, ?)
    `,
    checkCardSerialInterval: `
        SELECT (COUNT(*) = ?) AS matched FROM platform_card
        WHERE card_serial_no >= ? AND card_serial_no <= ?
    `,
    checkForAnyPendingTransfer: `
        SELECT (COUNT(*) = 0) AS allowed FROM platform_card_ownership_transfer
        WHERE (card_start_serial_no < ? || (card_start_serial_no + card_ownership_transfer_quantity - 1) > ?)
            AND ! (card_start_serial_no > ? || (card_start_serial_no + card_ownership_transfer_quantity - 1) < ?)
            AND card_ownership_transfer_status != 0
    `,
    fetchEncryptionKey: `
        SELECT config_param_value AS encryptionKey FROM platform_configuration WHERE config_param_name = 'hrnEncryptionKey'
    `,
    fetchCardsInfo: `
        SELECT l.lot_name AS lotName, c.card_serial_no AS cardSerialNo, platform_decrypt_hrn(c.card_hrn, ?) AS cardPin
        FROM platform_card AS c
        JOIN platform_lot AS l ON c.card_lot_id = l.lot_id
        WHERE l.lot_id = ? 
        ORDER BY c.card_serial_no ASC
    `,
    fetchCardTransferInfo: function (whereCondition) {
        return `
            SELECT cot.card_ownership_transfer_id AS ownershipTransferId, 
                CASE (cot.card_ownership_transfer_type)
                    WHEN 0 THEN 'Sales'
                    WHEN 1 THEN 'Transfer' 
                END AS transferType,
                CONCAT(u1.user_name, ' (', cot.card_ownership_transfer_from, ')') AS assignedBy, 
                CONCAT(u2.user_name, ' (', cot.card_ownership_transfer_to, ')') AS assignedTo, 
                cot.card_start_serial_no AS startSerialNo, cot.card_ownership_transfer_quantity AS quantity,
                if (p.package_name is null, 0, 1) as isPackage, if (p.package_name is null, pi.product_name, p.package_name) as \`name\`,
                CASE (cot.card_ownership_transfer_status)
                    WHEN 0 THEN 'Rejected'
                    WHEN 1 THEN 'Accepted'
                    WHEN 2 THEN 'Pending'
                END AS transferStatus,
                cot.card_ownership_decision_date AS decisionDate,
                cot.creation_date as createdAt
            FROM platform_card_ownership_transfer AS \`cot\`
            JOIN platform_users AS u1 ON cot.card_ownership_transfer_from = u1.user_id
            JOIN platform_users AS u2 ON cot.card_ownership_transfer_to = u2.user_id
            JOIN platform_card AS c ON cot.card_start_serial_no = c.card_serial_no
            LEFT JOIN platform_product_info AS \`pi\` ON c.card_product_id = \`pi\`.product_id
            LEFT JOIN platform_package AS \`p\` ON c.card_package_id = \`p\`.package_id
            ${whereCondition}
        `
    },
    updateCardTransferStatus: `
        UPDATE platform_card_ownership_transfer 
        SET card_ownership_transfer_status = ?, 
            card_ownership_decision_date = NOW(),
            card_ownership_remarks = ?,
            updated_by = ?
        WHERE card_ownership_transfer_id = ? AND card_ownership_transfer_status = 2
    `,
    cardSummary: `
        SELECT SUM(card_status = 0) AS totalFree, SUM(card_status = 1) AS totalActive, SUM(1) AS total
        FROM platform_card WHERE card_serial_no >= ? AND card_serial_no <= ?
    `
};
