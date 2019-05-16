module.exports = {
    createNotificationTemplate: `
		INSERT INTO notification_templates 
		(notification_type_id, title, template, deep_link, image_url, is_primary, status)
		VALUES(?, ?, ?, ?, ?, ?, ?)
	`,

    createNotifications: `INSERT INTO notifications (template_id, recipient, client_id) VALUES ?`,

    getNotifications: limit => `
		SELECT n.template_id, nt.notification_type_id, nt.title, nt.description, 
			nt.template, nt.image_url, nt.deep_link, nt.is_primary,
			nty.title as ntype_title, nty.description as ntype_description,
			nt.status, nt.created_date
		FROM notifications n 
			LEFT JOIN notification_templates nt ON n.template_id = nt.id AND nt.status = 1
			LEFT JOIN notification_types nty ON nt.notification_type_id = nty.id 
		WHERE n.recipient = ? AND n.status = 1 ${limit}
	`,

    updateNotificationCount: `UPDATE platform_users SET notification_count = notification_count + 1 WHERE user_id IN ?`,

    getNotificationCount: `SELECT notification_count as inAppNotificationCount FROM platform_users WHERE user_id = ?`,

    clearNotificationCount: `UPDATE platform_users SET notification_count = 0  WHERE user_id = ?`
}
