"use strict"

module.exports = {
    checkJompayRefId: `
        SELECT cso.sales_order_id AS salesOrderId, cso.sales_order_status, cso.sales_order_amount, cso.sales_order_total_amount,
        cso.created_by, cso.creation_date, ppi.sales_order_id AS paymentSalesId,
        cso.sales_order_user_id AS salesOrderUserId, cso.sales_order_status_note AS salesOrderStatusNote, 
        cu.user_id AS freezeUserId, cu.user_role_id AS freezeUserRole, cu.user_currency_id As freezeUserCurrency
        FROM platform_sales_order cso
        LEFT JOIN partner_payment_issues ppi ON cso.sales_order_id = ppi.sales_order_id
        LEFT JOIN platform_users cu ON cso.sales_order_user_id = cu.user_id
        WHERE cso.sales_order_reference_id = ?
    `,
    createJompayRequest: `
        INSERT INTO partner_payment_issues
        (actual_transfer_id, sales_order_id, issue_reason, approved_rejected_reason, doc_url, status, approved_rejected_by_id, approved_rejected_at, raised_by, created_by, issue_from, execution_enable_at, created_at) 
        VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `,
    updateJompayInfo: `
        UPDATE partner_payment_issues
        SET sales_order_id = ?,
        status = ?,
        approved_rejected_reason = ?,
        approved_rejected_by_id = ?,
        approved_rejected_at = ?
        WHERE id = ?
    `,
    jompayHistory: `
        SELECT id, actual_transfer_id, sales_order_id, issue_reason, approved_rejected_reason,
        status, approved_rejected_at, created_by, raised_by, created_at 
        FROM partner_payment_issues 
        WHERE created_by = ?
    `
}
