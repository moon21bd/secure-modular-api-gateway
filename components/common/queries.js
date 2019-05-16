'use strict';

module.exports = {
    baseCurrency: function (whereCondition) {
        return `
            SELECT currency_country_id AS currencyId, currency_name AS currencyName
            FROM platform_currency
            ${whereCondition}
        `;
    },
    keyForOTP: function (purpose, userId, token) { return 'otp.' + purpose + '.' + userId + '.' + token },
    UniquekeyForOTP: function (purpose, userId) { return 'otp.' + purpose + '.' + userId },
    keyForOTPAttempts: function (purpose, userId) { return 'otp.' + purpose + '.' + userId },
    keyForSessionId: function (userId, uuid) { return 'sessionid.' + userId + '.' + uuid },
    keyForContentInfo: function (contentId) { return 'content.' + contentId },
    getUserToken: `select distinct user_app_token from platform_users where user_app_token is not null and user_id > 0 and (user_id in (?) or user_name in (?))
    `,
};
