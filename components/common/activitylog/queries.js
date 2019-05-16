"use strict";

module.exports = {
  createActivityLog: `
    INSERT INTO platform_activity_log(request_id, request_url, api_request, ip, device)  values(?, ?, ?, ?, ?)
`,

  updateActivityLog: `
    UPDATE platform_activity_log SET user_id = ?,
       api_response = ?, updated_at = NOW() WHERE id = ? 
  `,
};
