module.exports = {
  findTransactionDetails: function (userId, limit = 50, offset = 0) {
    //test
    return `
        SELECT 
        u.user_name AS Received_From, 
        CAST(platform_currency_convertion(${userId}, 
        th.transfer_from_base_currency_amount,'-1') AS DECIMAL(10,2)) AS Received_Amount,
        th.transfer_from AS Sender_ID, 
        th.creation_date AS Balance_Received_Time, 
        th.transfer_id AS transactionId,
        CASE th.transfer_status
            WHEN 0 THEN 'Rejected'
            WHEN 1 THEN 'Successful'
        END AS Status, th.transfer_to AS Received_By_ID, u.user_name AS Received_User_Name, 
        u.user_full_name AS Received_User_Full_Name, u.user_mobileno AS Received_User_MobileNo, 
        th.transfer_ref_id AS Transaction_Ref_Id, cso.sales_order_bank_reference_id AS salesOrderBankRefId
        FROM platform_transfer_history AS th
        JOIN platform_users AS u ON th.transfer_to = u.user_id
        LEFT JOIN platform_sales_order AS cso ON th.transfer_ref_id = cso.sales_order_id
        WHERE th.transfer_ref_id = ? AND th.transfer_status=1 
        ORDER BY th.creation_date DESC LIMIT ${limit} OFFSET ${offset};
    `;
  },
};
