'use strict';

module.exports = {
    fetchDevices: function (conditions = "") {
        return `
        SELECT * FROM platform_user_device WHERE user_id = ? AND status = 'active' ${conditions}
    `;
    },

    addDevice: `
        INSERT INTO platform_user_device(user_id, device_id, device_name, device_session_id, created_at) 
        VALUES (?, ?, ?, ?, NOW())
    `,

    updateDevice: `
        UPDATE platform_user_device 
        SET status = 'deleted', deleted_at = NOW() 
        WHERE user_id = ? AND device_id = ?
    `,

    updateSession: `
        UPDATE platform_user_device SET device_session_id = ?
        WHERE user_id = ? AND device_id = ?
    `,
};