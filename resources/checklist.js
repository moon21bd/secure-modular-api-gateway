"use strict";

const checklist = {
  authorization: [
    "/api/bd-order-api",
    "/api/bd-order-api-status",
    "/api/top-up/check",
    "/api/top-up/request",
    "/api/top-up/status",
    "/api/datapack/list",
    "/api/datapack/check",
    "/api/datapack/request",
    "/api/datapack/status",
    "/api/transaction-commission/callback",
    "/api/platform-get-balance",
    "/api/country-b-order-api",
    "/api/country-b-order-api-status",
    "/api/send-flexiload",
    "/api/card/revoke",
    "/api/download/deposit-slips/",
    "/api/order/callback",
    "/api/redeem-scratch-card",
    "/api/foster/trx/initiate",
    "/api/foster/trx/update",
    "/api/foster/trx/status",
    "/api/reports/download",
    "/api/transaction/callback",
    "/api/cash-order/callback",
    "/api/transaction-commission/execution/callback",
    "/api/jompay/callback",
    "/api/jompay/v2/callback",
    "/api/external/",
    "/api/redeem-card",
    "/api/redeem-card/status",
    "/api/balance/check",
    "/api/pgw/callback/test",

    "/api/digi/account/balance-add",
    "/api/digi/top-up/request",
    "/api/digi/data-pack/request",
    "/api/tp/operator/identify",
    "/api/tp/product/show",
    "/api/tp/reports/generate",
    "/api/tp/balance/check",
    "/api/digi/top-up/check",
    "/api/digi/datapack/check",
    "/api/tp/voice/balance/check",
    "/api/tp/wallet/balance-add",
    "/api/digi/bill-payment/request",
    "/api/pgw/transaction/callback",
    "/api/referral/add/balance",
    "/api/referral/users/role",

    "/api/tp/product/list",
    "/api/tp/bill-payment/info",
    "/api/tp/bill-payment/request",
    "/api/tp/transaction/status",

    "/api/digi/zulu/request",

    "/api/send/notification",
    "/api/user/support-contacts",
    "/api/notification-inapp/send",
    "/api/documents",

    "/api/channelB/top-up/request",
    "/api/channelB/data-pack/request",
    "/api/channelB/datapack/check",
    "/api/channelB/top-up/check",
    "/api/impact/get-pin",
    "/api/impact/product/card-statistic",

    "/api/mobile/top-up/check",
    "/api/mobile/top-up/request",
    "/api/mobile/datapack/check",
    "/api/mobile/datapack/request",
    "/api/channelB/wallet/balance-add",
    "/api/partnerC/is-cico",
    "/api/partnerC/register-new-cico",
    "/api/partnerC/fetch-wallet",
    "/api/partnerC/cash-in/request",
    "/api/partnerC/check-payment",
    "/api/bank-lists",
    "/api/upload-bank-receipt",
    "/api/partnerC/earning-report",
  ],
  encryption: [
    "/api/configuration/create",
    "/api/configuration/update",
    "/api/configuration/show",
    "/api/send-flexiload",
    "/api/file-upload",
    "/api/card/revoke",
    "/api/reports/generate",
    "/api/download/deposit-slips/",
    "/api/order/callback",
    "/api/redeem-scratch-card",
    "/api/get-user-list",
    "/api/foster/trx/initiate",
    "/api/foster/trx/update",
    "/api/foster/trx/status",
    "/api/transaction/callback",
    "/balance/check",
    "/api/pgw/transaction/callback",
    "/api/jompay/payment-issue/raise",
    "/api/business-agreement",
    "/api/notification-inapp/send",
    "/api/impact/get-pin",
    "/api/impact/product/card-statistic",
    "/api/upload-bank-receipt",
  ],
  decryption: [
    "/api/configuration/create",
    "/api/configuration/update",
    "/api/configuration/show",
    "/api/send-flexiload",
    "/api/file-upload",
    "/api/card/revoke",
    "/api/download/deposit-slips/",
    "/api/order/callback",
    "/api/redeem-scratch-card",
    "/api/foster/trx/initiate",
    "/api/foster/trx/update",
    "/api/foster/trx/status",
    "/api/transaction/callback",
    "/api/transaction-commission/execution/callback",
    "/api/jompay/callback",
    "/api/jompay/v2/callback",
    "/balance/check",
    "/api/pgw/transaction/callback",
    "/api/referral/add/balance",
    "/api/referral/users/role",
    "/api/jompay/payment-issue/raise",
    "/api/business-agreement",
    "/api/notification-inapp/send",
    "/api/impact/get-pin",
    "/api/impact/product/card-statistic",
    "/api/upload-bank-receipt",
  ],
};

module.exports = {
  checkAuthorization: function (url) {
    for (let index in checklist.authorization) {
      if (
        url
          .toLowerCase()
          .startsWith(checklist.authorization[index].toLowerCase())
      ) {
        return false;
      }
    }

    return true;
  },
  checkEncryption: function (url) {
    for (let index in checklist.encryption) {
      if (
        url.toLowerCase().startsWith(checklist.encryption[index].toLowerCase())
      ) {
        return false;
      }
    }

    return true;
  },
  checkDecryption: function (url) {
    for (let index in checklist.decryption) {
      if (
        url.toLowerCase().startsWith(checklist.decryption[index].toLowerCase())
      ) {
        return false;
      }
    }

    return true;
  },
};
