const Joi = require("joi");

// Common validation patterns
const phoneRegex = /^[0-9]{1,20}$/;
const amountRegex = /^[0-9]+(\.[0-9]{1,2})?$/;

const registerNewCicoSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  name: Joi.string().trim().min(2).max(100).required(),
  mobile_no: Joi.string().regex(phoneRegex).required(),
  state: Joi.string().trim().min(2).max(50).required(),
});

const isCicoSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  mobile_no: Joi.string().regex(phoneRegex).optional()
});

const fetchWalletSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  receiverNo: Joi.string().regex(phoneRegex).required(),
});

const cashInRequestSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  senderNo: Joi.string().regex(phoneRegex).required(),
  receiverNo: Joi.string().regex(phoneRegex).required(),
  productId: Joi.number().integer().min(1).required(),
  amount: Joi.number().positive().precision(2).required(),
  deductibleAmount: Joi.number().positive().required(),
  password: Joi.string().required(),
});

const commissionReportsSchema = Joi.object()
  .keys({
    month: Joi.number().integer().min(1).max(12).optional(),
    year: Joi.number().integer().min(2020).max(2030).optional(),
    lotNumber: Joi.string().trim().max(50).optional(),
    userId: Joi.number().integer().min(1).required(),
  })
  .options({ allowUnknown: true }); // simplified, because no .custom()


const checkPaymentSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  amount: Joi.number().positive().required(),
  productId: Joi.number().integer().min(1).required(),
});

const earningReportSchema = Joi.object().keys({
  month: Joi.number().integer().min(1).max(12).optional(),
  year: Joi.number().integer().min(2025).max(2075).optional(),
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
});

module.exports = {
  registerNewCicoSchema,
  isCicoSchema,
  fetchWalletSchema,
  cashInRequestSchema,
  checkPaymentSchema,
  commissionReportsSchema,
  earningReportSchema,
};
