'use strict';

module.exports = {
    createPromoInfo: `
        INSERT INTO platform_promo(promo_type, promo_text, promo_masking_text, promo_start_time, promo_end_time, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
    `,
    updatePromoInfo: `
        UPDATE platform_promo
        SET promo_type = IF (? IS NULL, promo_type, ?),
            promo_text = IF (? IS NULL, promo_text, ?),
            promo_masking_text = IF (? IS NULL, promo_masking_text, ?),
            promo_start_time = IF (? IS NULL, promo_start_time, ?),
            promo_end_time = IF (? IS NULL, promo_end_time, ?),
            updated_by = ?
        WHERE promo_id = ?
    `,
    showPromoInfo: `
        SELECT promo_id AS promoId, promo_type AS promoType, promo_text AS promoText, promo_start_time AS promoStartTime,
               promo_end_time AS promoEndTime, created_by AS createdBy, updated_by AS updatedBy, creation_date AS createdAt, last_update_date AS updatedAt
        FROM platform_promo
        WHERE (? IS NULL OR promo_id = ?)
    `,
    checkPromoInfo: `
        SELECT DISTINCT c.card_serial_no AS cardSerialNo, p.promo_id AS promoId, eh.created_by AS createdBy
        FROM platform_card AS c
        JOIN (SELECT platform_encrypt_hrn(?, '') AS card_hrn) AS temp ON c.card_hrn = temp.card_hrn
        JOIN platform_lot AS l ON c.card_lot_id = l.lot_id
        JOIN platform_promo AS p ON l.lot_promo_id = p.promo_id
        JOIN platform_execution_history AS eh On c.card_serial_no = eh.execution_product_serial_no
        WHERE p.promo_start_time <= NOW() AND p.promo_end_time >= NOW() 
        AND eh.execution_transaction_ref_id = ? AND eh.execution_mobile_no LIKE ? 
        AND eh.execution_sender = 'NA'
    `,
    insertPromoUserInfo: `
        INSERT INTO platform_promo_users(promo_id, promo_user_input, promo_card_serial_no, promo_bno, created_by)
        VALUES (?, ?, ?, ?, ?)
    `,
    updateExecutionHistory: `
        UPDATE platform_execution_history SET execution_sender = ?, updated_by = ?
        WHERE execution_transaction_ref_id = ?
    `
};