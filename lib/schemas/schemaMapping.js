const schemas = require("./index"); // auto-load all schema files

const schemaMapping = {
  "/api/partnerC/register-new-cico": schemas.registerNewCicoSchema,
  "/api/partnerC/is-cico": schemas.isCicoSchema,
  "/api/partnerC/fetch-wallet": schemas.fetchWalletSchema,
  "/api/partnerC/check-payment": schemas.checkPaymentSchema,
  "/api/partnerC/cash-in/request": schemas.cashInRequestSchema,
  "/api/partnerC/commission-reports": schemas.commissionReportsSchema,
};

module.exports = schemaMapping;
