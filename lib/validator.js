const BaseJoi = require("joi");
const Extension = require("joi-date-extensions");
const Joi = BaseJoi.extend(Extension);
const moment = require("moment");

const db = require("../resources/database.connection");
const queries = require("../resources/database.queries");
const resultCodes = require("../lib/result.codes");
const resDet = require("../lib/result.details");

function getResErr(validationErr) {
  switch (validationErr.type) {
    case "any.required":
      return resultCodes.REQUIRED_PARAMS_ERR;
    default:
      return resultCodes.INVALID_PARAMS_ERR;
  }
}

const authSchema = Joi.object().keys({
  grantType: Joi.string().required(),
  clientId: Joi.string().required(),
  clientSecret: Joi.string().required(),
  nonce: Joi.string().required(),
});

const otpSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  otp: Joi.string().required(),
  purpose: Joi.string()
    .valid(
      "login",
      "sign-up",
      "fund-transfer",
      "order-request",
      "platform-dialer",
      "add-balance",
      "soft-pin",
      "platform-cash",
      "bill-payment-request",
      "forget-password",
      "phone-number-change",
      "email-change",
      "zulu-coupon-request",
      "zulu-request",
      "voucher-pin",
      "platform-digi-payment",
      "general",
      "add-email",
      "update-email"
    )
    .required(),
  nonce: Joi.string().optional(),
  mobileNo: Joi.string()
    .regex(/^[0-9]{1,20}$/)
    .optional(),
  email: Joi.string().optional(),
  countryCode: Joi.string().min(1).max(10).optional(),
});

const sessionSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  nonce: Joi.string().optional(),
});

const signUpSchemaApp = Joi.object().keys({
  username: Joi.string().min(1).max(128).required(),
  fullName: Joi.string().min(1).max(128).required(),
  password: Joi.string().min(6).max(128).required(),
  email: Joi.string().email().optional(),
  countryCode: Joi.string().min(1).max(10).required(),
  mobileNo: Joi.string()
    .regex(/^[0-9]{1,20}$/)
    .required(),
  otp: Joi.string().required(),
  nationality: Joi.string().max(128).optional(),
  src: Joi.string().max(64).optional(),
  cmp: Joi.string().max(64).optional(),
  nonce: Joi.string().optional(),
});
const signUpSchema = Joi.object().keys({
  username: Joi.string().min(1).max(128).required(),
  fullName: Joi.string().min(1).max(128).required(),
  password: Joi.string().min(1).max(128).required(),
  email: Joi.string().email().required(),
  countryCode: Joi.string().min(1).max(10).required(),
  mobileNo: Joi.string()
    .regex(/^[0-9]{1,20}$/)
    .required(),
  nonce: Joi.string().optional(),
});

const loginSchema = Joi.object()
  .keys({
    username: Joi.string().required(),
    password: Joi.string().required(),
    logId: Joi.number().optional(),
    deviceId: Joi.string().min(1).optional(),
    appName: Joi.string().optional(),
    nonce: Joi.string().optional(),
  })
  .with("username", "password");
const loginSchemaPlatformBot = Joi.object()
  .keys({
    username: Joi.string().required(),
    password: Joi.string().required(),
    nonce: Joi.string().optional(),
    language: Joi.string().optional(),
  })
  .with("username", "password");

const userInfoSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  nonce: Joi.string().optional(),
});

const specificUserInfoSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  queriedUserId: Joi.number().integer().min(1).required(),
  nonce: Joi.string().optional(),
});

const productAuthInfoSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  productCategoryId: Joi.number().integer().min(1).required(),
  nonce: Joi.string().optional(),
});

const profileCreateSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  username: Joi.string().min(1).max(128).required(),
  fullName: Joi.string().min(1).max(128).required(),
  password: Joi.string().min(1).max(128).required(),
  parentId: Joi.number().integer().min(1).required(),
  contactId: Joi.number().integer().min(1).required(),
  email: Joi.string().email().required(),
  countryCode: Joi.string().min(1).max(10).required(),
  mobileNo: Joi.string()
    .regex(/^[0-9]{1,20}$/)
    .required(),
  nonce: Joi.string().optional(),
});

const resellerProfileCreateSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  username: Joi.string().min(1).max(128).required(),
  fullName: Joi.string().min(1).max(128).required(),
  password: Joi.string().min(1).max(128).required(),
  email: Joi.string().email().required(),
  countryCode: Joi.string().min(1).max(10).required(),
  mobileNo: Joi.string()
    .regex(/^[0-9]{1,20}$/)
    .required(),
  nonce: Joi.string().optional(),
});

const profileUpdateSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  updatedFields: Joi.object()
    .keys({
      fullName: Joi.string().min(1).max(128).optional(),
      email: Joi.string().email().optional(),
      loginEmailAuthentication: Joi.boolean().valid(true, false).optional(),
      fundTransferPasswordAuthentication: Joi.boolean()
        .valid(true, false)
        .optional(),
      fundTransferEmailAuthentication: Joi.boolean()
        .valid(true, false)
        .optional(),
      forgetPasswordEmailAuthentication: Joi.boolean()
        .valid(true, false)
        .optional(),
      deviceRegistrationEmailAuthentication: Joi.boolean()
        .valid(true, false)
        .optional(),
      productAuthentication: Joi.array()
        .items(
          Joi.object()
            .keys({
              categoryId: Joi.number().integer().min(1).required(),
              passwordAuthentication: Joi.boolean().valid(true, false),
              emailAuthentication: Joi.boolean().valid(true, false),
            })
            .or("passwordAuthentication", "emailAuthentication")
        )
        .optional(),
      resources: Joi.array()
        .items(
          Joi.object().keys({
            name: Joi.string().valid("profile-pic", "passport-pic").required(),
            contentId: Joi.string().required(),
          })
        )
        .optional(),
      latitude: Joi.number().min(-90).max(90).optional(),
      longitude: Joi.number().min(-180).max(180).optional(),
    })
    .or(
      "fullName",
      "email",
      "loginEmailAuthentication",
      "fundTransferPasswordAuthentication",
      "fundTransferEmailAuthentication",
      "forgetPasswordEmailAuthentication",
      "deviceRegistrationEmailAuthentication",
      "productAuthentication",
      "resources",
      "latitude",
      "longitude"
    ),
  nonce: Joi.string().optional(),
});

const userProfileUpdateSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  updatedUserId: Joi.number()
    .integer()
    .min(1)
    .disallow(Joi.ref("userId"))
    .required(),
  updatedFields: Joi.object()
    .keys({
      fullName: Joi.string().min(1).max(128).optional(),
      status: Joi.string()
        .valid("Active", "Suspended", "Inactive", "Locked", "Pending")
        .optional(),
      parentId: Joi.number().integer().min(1).optional(),
      contactId: Joi.number().integer().min(1).optional(),
      roleId: Joi.number().integer().min(1).optional(),
      password: Joi.string().min(1).max(128).optional(),
      email: Joi.string().email().optional(),
      loginEmailAuthentication: Joi.boolean().valid(true, false).optional(),
      fundTransferPasswordAuthentication: Joi.boolean()
        .valid(true, false)
        .optional(),
      fundTransferEmailAuthentication: Joi.boolean()
        .valid(true, false)
        .optional(),
      routeId: Joi.number().integer().min(1).optional(),
      productAuthentication: Joi.array()
        .items(
          Joi.object()
            .keys({
              categoryId: Joi.number().integer().min(1).required(),
              passwordAuthentication: Joi.boolean().valid(true, false),
              emailAuthentication: Joi.boolean().valid(true, false),
            })
            .or("passwordAuthentication", "emailAuthentication")
        )
        .optional(),
      resources: Joi.array()
        .items(
          Joi.object().keys({
            name: Joi.string().valid("profile-pic", "passport-pic").required(),
            contentId: Joi.string().required(),
          })
        )
        .optional(),
      latitude: Joi.number().min(-90).max(90).optional(),
      longitude: Joi.number().min(-180).max(180).optional(),
    })
    .or(
      "fullName",
      "status",
      "parentId",
      "contactId",
      "roleId",
      "password",
      "email",
      "loginEmailAuthentication",
      "fundTransferPasswordAuthentication",
      "fundTransferEmailAuthentication",
      "routeId",
      "productAuthentication",
      "resources",
      "latitude",
      "longitude"
    ),
  nonce: Joi.string().optional(),
});

const checkCashAgentIdSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  cashAgentId: Joi.string().max(64).required(),
  nonce: Joi.string().optional(),
});

const setCashAgentIdSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  assignedUserId: Joi.number()
    .integer()
    .min(1)
    .disallow(Joi.ref("userId"))
    .required(),
  cashAgentId: Joi.string().max(64).required(),
  nonce: Joi.string().optional(),
});

const changePasswordSchema = Joi.object()
  .keys({
    userId: Joi.number().integer().min(1).required(),
    sessionId: Joi.string().required(),
    oldPassword: Joi.string().required(),
    newPassword: Joi.string().required(),
    nonce: Joi.string().optional(),
  })
  .with("username", "oldPassword");
const forgetPasswordSchemaWithOtp = Joi.object().keys({
  username: Joi.string().required(),
  confirmPassword: Joi.string().required(),
  password: Joi.string().required(),
  otp: Joi.string().required(),
  mobileNo: Joi.string().required(),
  purpose: Joi.string().required(),
  nonce: Joi.string().optional(),
});

const resetPasswordCreateSchema = Joi.object().keys({
  username: Joi.string().required(),
  nonce: Joi.string().optional(),
});

const resetPasswordVerifySchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  token: Joi.string().required(),
  nonce: Joi.string().optional(),
});

const resetPasswordUpdateSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  token: Joi.string().required(),
  newPassword: Joi.string().required(),
  nonce: Joi.string().optional(),
});

const checkPasswordSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  password: Joi.string().required(),
});

const checkFundTransferSchema = Joi.object().keys({
  transferFrom: Joi.number().integer().min(1).required(),
  transferTo: Joi.number()
    .integer()
    .min(1)
    .disallow(Joi.ref("transferFrom"))
    .required(),
  amount: Joi.number().positive().precision(2).required(),
  currencyId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  walletTypeId: Joi.number().integer().min(1).optional(),
  password: Joi.string().optional(),
  nonce: Joi.string().optional(),
});

const fundTransferSchema = Joi.object().keys({
  transferType: Joi.number().integer().valid(0, 1, 2, 3).required(),
  transferFrom: Joi.number().integer().min(1).required(),
  transferTo: Joi.number()
    .integer()
    .min(1)
    .disallow(Joi.ref("transferFrom"))
    .required(),
  amount: Joi.number().positive().precision(2).required(),
  currencyId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  channel: Joi.string().max(64).required(),
  walletTypeId: Joi.number().integer().min(1).optional(),
  password: Joi.string().optional(),
  nonce: Joi.string().optional(),
});

const productCreateSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  productName: Joi.string().max(128).required(),
  productDescription: Joi.string().max(1024).optional(),
  productCategoryId: Joi.number().integer().min(1).required(),
  productValue: Joi.number().positive().precision(2).optional(),
  productCurrencyId: Joi.number().integer().min(1).required(),
  productSalesValue: Joi.number().positive().precision(2).optional(),
  isDiscountApplicable: Joi.number().integer().valid(0, 1).optional(),
  isComissionApplicable: Joi.number().integer().valid(0, 1).optional(),
  hasVariableAmount: Joi.number().integer().valid(0, 1, 2).optional(),
  productMinimumValue: Joi.number()
    .when("hasVariableAmount", {
      is: 0,
      then: Joi.number().positive().precision(2).optional(),
    })
    .when("hasVariableAmount", {
      is: 1,
      then: Joi.number().positive().precision(2).required(),
    })
    .when("hasVariableAmount", {
      is: 2,
      then: Joi.number().positive().precision(2).required(),
    }),
  productMaximumValue: Joi.number()
    .when("hasVariableAmount", {
      is: 0,
      then: Joi.number().positive().precision(2).optional(),
    })
    .when("hasVariableAmount", {
      is: 1,
      then: Joi.number().positive().precision(2).required(),
    })
    .when("hasVariableAmount", {
      is: 2,
      then: Joi.number().positive().precision(2).required(),
    }),
  probableAmounts: Joi.array()
    .items(Joi.number().positive().precision(2))
    .min(1)
    .unique()
    .optional(),
  reference1: Joi.string().max(128).optional(),
  reference2: Joi.string().max(128).optional(),
  reference3: Joi.string().max(128).optional(),
  reference4: Joi.string().max(128).optional(),
  reference5: Joi.string().max(128).optional(),
  reference6: Joi.string().max(128).optional(),
  reference7: Joi.string().max(128).optional(),
  resources: Joi.array().items(
    Joi.object().keys({
      name: Joi.string().valid("product-pic").required(),
      contentId: Joi.string().required(),
    })
  ),
});

const productUpdateSchema = Joi.object()
  .keys({
    userId: Joi.number().integer().min(1).required(),
    sessionId: Joi.string().required(),
    productId: Joi.number().integer().min(1).required(),
    productName: Joi.string().max(128).optional(),
    productDescription: Joi.string().max(1024).optional(),
    productStatus: Joi.number().integer().valid(0, 1).optional(),
    productCategoryId: Joi.number().integer().min(1).optional(),
    productExecutionConfigId: Joi.number().integer().min(1).optional(),
    productValue: Joi.number().positive().precision(2).optional(),
    productCurrencyId: Joi.number().integer().min(1).optional(),
    productSalesValue: Joi.number().min(0).precision(2).optional(),
    isDiscountApplicable: Joi.number().integer().valid(0, 1).optional(),
    isComissionApplicable: Joi.number().integer().valid(0, 1).optional(),
    hasVariableAmount: Joi.number().integer().valid(0, 1, 2).optional(),
    productMinimumValue: Joi.number().positive().precision(2).optional(),
    productMaximumValue: Joi.number().positive().precision(2).optional(),
    probableAmounts: Joi.array()
      .items(Joi.number().positive().precision(2))
      .min(1)
      .unique()
      .optional(),
    reference1: Joi.string().max(128).optional(),
    reference2: Joi.string().max(128).optional(),
    reference3: Joi.string().max(128).optional(),
    reference4: Joi.string().max(128).optional(),
    reference5: Joi.string().max(128).optional(),
    reference6: Joi.string().max(128).optional(),
    reference7: Joi.string().max(128).optional(),
    resources: Joi.array()
      .items(
        Joi.object().keys({
          name: Joi.string().valid("product-pic").required(),
          contentId: Joi.string().required(),
        })
      )
      .optional(),
  })
  .or(
    "productName",
    "productDescription",
    "productStatus",
    "productCategoryId",
    "productExecutionConfigId",
    "productValue",
    "productCurrencyId",
    "productSalesValue",
    "isDiscountApplicable",
    "isComissionApplicable",
    "hasVariableAmount",
    "productMinimumValue",
    "productMaximumValue",
    "probableAmounts",
    "reference1",
    "reference2",
    "reference3",
    "reference4",
    "reference5",
    "reference6",
    "reference7",
    "resources"
  );

const productShowSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  filters: Joi.object()
    .keys({
      productId: Joi.number().integer().min(1).optional(),
      categoryId: Joi.number().integer().min(1).optional(),
      countryCode: Joi.string().min(1).max(10).optional(),
      productOffer: Joi.number().integer().min(1).optional(),
    })
    .required(),
  addCommission: Joi.string().valid("yes", "no").optional(),
  nonce: Joi.string().optional(),
});

const thirdPartyProductShowSchema = Joi.object().keys({
  srcuid: Joi.string().required(),
  srcpwd: Joi.string().required(),
  userId: Joi.number().integer().min(1).required(),

  filters: Joi.object()
    .keys({
      productId: Joi.number().integer().min(1).optional(),
      categoryId: Joi.number().integer().min(1).optional(),
      countryCode: Joi.string().min(1).max(10).optional(),
    })
    .required(),
  addCommission: Joi.string().valid("yes", "no").optional(),
  nonce: Joi.string().optional(),
  channel: Joi.string().optional(),
});

const productShowAllSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  filters: Joi.object()
    .keys({
      productId: Joi.number().integer().min(1).optional(),
      categoryId: Joi.number().integer().min(1).optional(),
      countryCode: Joi.string().min(1).max(10).optional(),
    })
    .required(),
  nonce: Joi.string().optional(),
});

const packageCreateSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  packageName: Joi.string().max(128).required(),
  packageDescription: Joi.string().max(1024).optional(),
  groupName: Joi.string().max(128).optional(),
  isViewable: Joi.number().integer().valid(0, 1).optional(),
  packageSalesValue: Joi.number().positive().precision(2).required(),
  productList: Joi.array()
    .items(
      Joi.object().keys({
        id: Joi.number().integer().min(1).required(),
        order: Joi.number().integer().min(0).optional(),
        executeAfter: Joi.number().integer().min(0).optional(),
      })
    )
    .min(1)
    .optional(),
});

const packageUpdateSchema = Joi.object()
  .keys({
    userId: Joi.number().integer().min(1).required(),
    sessionId: Joi.string().required(),
    packageId: Joi.number().integer().min(1).required(),
    packageName: Joi.string().max(128).optional(),
    packageDescription: Joi.string().max(1024).optional(),
    groupName: Joi.string().max(128).optional(),
    isViewable: Joi.number().integer().valid(0, 1).optional(),
    status: Joi.number().integer().valid(0, 1).optional(),
    packageSalesValue: Joi.number().positive().precision(2).optional(),
    productList: Joi.array()
      .items(
        Joi.object().keys({
          id: Joi.number().integer().min(1).required(),
          action: Joi.number().integer().valid(0, 1).required(),
          order: Joi.number()
            .when("action", {
              is: 0,
              then: Joi.number().integer().min(0).optional(),
            })
            .when("action", {
              is: 1,
              then: Joi.number().integer().min(0).required(),
            }),
          executeAfter: Joi.number()
            .when("action", {
              is: 0,
              then: Joi.number().integer().min(0).optional(),
            })
            .when("action", {
              is: 1,
              then: Joi.number().integer().min(0).required(),
            }),
        })
      )
      .min(1)
      .optional(),
  })
  .or(
    "packageName",
    "packageDescription",
    "groupName",
    "isViewable",
    "status",
    "packageSalesValue",
    "productList"
  );

const packageShowSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  filters: Joi.object()
    .keys({
      packageId: Joi.number().integer().min(1).optional(),
      groupName: Joi.string().max(128).optional(),
      isViewable: Joi.number().integer().valid(0, 1).optional(),
      status: Joi.number().integer().valid(0, 1).optional(),
      withDetails: Joi.boolean().optional(),
    })
    .required(),
  nonce: Joi.string().optional(),
});

const packagePurchaseRequestSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  packageId: Joi.number().integer().min(1).required(),
  channel: Joi.string().required(),
  nonce: Joi.string().optional(),
  walletTypeId: Joi.number().integer().min(1).optional(),
});

const packagePurchaseRedeemRequestSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  packageOrderDetailsId: Joi.number().integer().min(1).required(),
  executedProductId: Joi.number().integer().min(1).required(),
  executionData: Joi.object().optional(),
  channel: Joi.string().required(),
  nonce: Joi.string().optional(),
  walletTypeId: Joi.number().integer().min(1).optional(),
});

const packageOrderFetchSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  filters: Joi.object()
    .keys({
      atLeastOneRedeemableProduct: Joi.number()
        .integer()
        .valid(0, 1)
        .optional(),
      startDate: Joi.date()
        .format("YYYY-MM-DD")
        .options({
          convert: true,
        })
        .optional(),
      endDate: Joi.date()
        .format("YYYY-MM-DD")
        .min(Joi.ref("startDate"))
        .options({
          convert: true,
        })
        .optional(),
      offset: Joi.number().integer().min(0).optional(),
      limit: Joi.number().integer().min(1).optional(),
    })
    .required(),
  nonce: Joi.string().optional(),
});

const createProductRatesSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  rateType: Joi.string().valid("commission", "discount").optional(),
  productId: Joi.number().integer().min(1).required(),
  roleId: Joi.number().integer().min(1).optional(),
  appliedUserId: Joi.number().integer().min(1).optional(),
  priority: Joi.number().integer().min(0).optional(),
  rateApplicableType: Joi.number().integer().valid(0, 1).optional(),
  rateAmount: Joi.number().precision(2).required(),
  nonce: Joi.string().optional(),
});

const updateProductRatesSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  productRatesId: Joi.number().integer().min(1).required(),
  updatedFields: Joi.object()
    .keys({
      rateType: Joi.string().valid("commission", "discount").optional(),
      roleId: Joi.number().integer().min(0).optional(),
      appliedUserId: Joi.number().integer().min(0).optional(),
      priority: Joi.number().integer().min(0).optional(),
      rateApplicableType: Joi.number().integer().valid(0, 1).optional(),
      productId: Joi.number().integer().min(1).optional(),
      rateAmount: Joi.number().precision(2).optional(),
      status: Joi.number().integer().valid(0, 1).optional(),
    })
    .or(
      "rateType",
      "roleId",
      "appliedUserId",
      "priority",
      "rateApplicableType",
      "productId",
      "rateAmount",
      "status"
    )
    .required(),
  nonce: Joi.string().optional(),
});

const showProductRatesSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  filters: Joi.object()
    .keys({
      productRatesId: Joi.number().integer().min(1).optional(),
      productId: Joi.number().integer().min(1).optional(),
      roleId: Joi.number().integer().min(1).optional(),
      categoryId: Joi.number().integer().min(1).optional(),
    })
    .required(),
  nonce: Joi.string().optional(),
});

const checkOrderRequestSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  requestType: Joi.string()
    .valid(
      "TOP_UP",
      "INTERNET",
      "BILL_PAYMENT",
      "SERVICE_A",
      "SERVICE_D",
      "CHANNEL_B",
      "SERVICE_E"
    )
    .required(),
  productId: Joi.number().integer().min(1).required(),
  amount: Joi.number().positive().precision(2).optional(),
  currencyId: Joi.number().integer().min(1).required(),
  channel: Joi.string().optional(),
  nonce: Joi.string().optional(),
});

const orderRequestSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  requestType: Joi.string().valid("TOP_UP", "INTERNET").required(),
  mobileNo: Joi.string()
    .regex(/^[0-9]{1,20}$/)
    .required(),
  productCategoryId: Joi.number().integer().min(1).required(),
  productId: Joi.number().integer().min(1).required(),
  amount: Joi.number().positive().precision(2).optional(),
  currencyId: Joi.number().integer().min(1).required(),
  channel: Joi.string().required(),
  password: Joi.string().optional(),
  nonce: Joi.string().optional(),
  walletTypeId: Joi.number().integer().min(1).optional(),
  paymentMethodId: Joi.number().integer().min(1).optional(),
});

const billPaymentInfoSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  providerAccountId: Joi.string().optional(),
  productId: Joi.number().integer().min(1).required(),
  additionalData: Joi.object().optional(),
  nonce: Joi.string().optional(),
});

const billPaymentRequestSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  userPwd: Joi.when("channel", {
    is: Joi.string().valid("channel_b", "voice"),
    then: Joi.string().required(),
    otherwise: Joi.forbidden(),
  }),
  customer_tid: Joi.when("channel", {
    is: Joi.string().valid("channel_b", "voice"),
    then: Joi.string().max(64).required(),
    otherwise: Joi.forbidden(),
  }),
  sessionId: Joi.string().required(),
  providerAccountId: Joi.string().optional(),
  productCategoryId: Joi.number().integer().min(1).required(),
  productId: Joi.number().integer().min(1).required(),
  amount: Joi.number().positive().precision(2).optional(),
  currencyId: Joi.number().integer().min(1).required(),
  channel: Joi.string().required(),
  additionalData: Joi.object().optional(),
  password: Joi.string().optional(),
  nonce: Joi.string().optional(),
  walletTypeId: Joi.when("channel", {
    is: Joi.string().valid("channel_b", "voice"),
    then: Joi.string().max(64).required(),
    otherwise: Joi.number().integer().optional(),
  }),
  paymentMethodId: Joi.number().integer().min(1).optional(),
});

const digiBillPaymentSchema = Joi.object().keys({
  srcuid: Joi.string().max(128).required(),
  srcpwd: Joi.string().max(128).required(),
  /*
        msisdn: Joi.string().max(20).required(),
    */
  providerAccountId: Joi.string().required(),
  productCategoryId: Joi.number().integer().min(1).required(),
  productId: Joi.number().integer().min(1).required(),
  amount: Joi.number().positive().precision(2).optional(),
  currencyId: Joi.number().integer().min(1).required(),
  channel: Joi.string().required(),
  additionalData: Joi.object().optional(),
  customer_tid: Joi.string().max(64).required(),
  password: Joi.string().optional(),
  nonce: Joi.string().optional(),
});
const digiWalletbalaneAddSchema = Joi.object().keys({
  srcuid: Joi.string().max(128).required(),
  srcpwd: Joi.string().max(128).required(),
  amount: Joi.number().positive().precision(2).optional(),
  currencyId: Joi.number().integer().min(1).required(),
  userId: Joi.string().required(),
  walletTypeId: Joi.string().max(64).required(),
  nonce: Joi.string().optional(),
});
const bulkOrderRequestCheckSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  data: Joi.array().items(Joi.array()).min(1).required(),
});

const bulkOrderRequestFinalizeSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  batchId: Joi.string().required(),
});

const checkDialerOrderRequestSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  amount: Joi.number().positive().precision(2).required(),
});

const dialerOrderRequestSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  dialerId: Joi.string()
    .regex(/^[0-9]{1,20}$/)
    .required(),
  amount: Joi.number().positive().precision(2).required(),
  channel: Joi.string().required(),
  password: Joi.string().optional(),
  nonce: Joi.string().optional(),
  walletTypeId: Joi.number().integer().min(1).optional(),
});

const checkCashOrderRequestSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  mobileNo: Joi.string()
    .regex(/^[0-9]{1,20}$/)
    .required(),
  amount: Joi.number().positive().precision(2).required(),
});

const cashOrderRequestSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  mobileNo: Joi.string()
    .regex(/^[0-9]{1,20}$/)
    .required(),
  amount: Joi.number().positive().precision(2).required(),
  channel: Joi.string().required(),
  password: Joi.string().optional(),
  nonce: Joi.string().optional(),
});

const updateOrderRequestSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  transactionId: Joi.number().integer().min(1).required(),
  action: Joi.number().integer().valid(0, 1, 2).required(),
  remarks: Joi.string().max(512).required(),
  channel: Joi.string().required(),
  nonce: Joi.string().optional(),
});

const roleInsertSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  name: Joi.string().max(128).required(),
  description: Joi.string().max(1024).optional(),
  level: Joi.number().integer().min(0).max(10000).required(),
  menuPermission: Joi.string().required(),
  allowSales: Joi.number().integer().valid(0, 1).optional(),
  nonce: Joi.string().optional(),
});

const roleUpdateSchema = Joi.object()
  .keys({
    userId: Joi.number().integer().min(1).required(),
    sessionId: Joi.string().required(),
    roleId: Joi.number().min(1).required(),
    name: Joi.string().max(128),
    description: Joi.string().max(1024),
    level: Joi.number().integer().min(0).max(10000),
    menuPermission: Joi.string(),
    allowSales: Joi.number().integer().valid(0, 1),
    status: Joi.number().integer().valid(0, 1),
    nonce: Joi.string().optional(),
  })
  .or("name", "description", "level", "menuPermission", "allowSales", "status");

const roleSettingUpdateSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  roleId: Joi.number().min(1).required(),
  updatedFields: Joi.object()
    .keys({
      allowedUserType: Joi.number().integer().valid(0, 1, 2, 3).optional(),
      allowAllStatus: Joi.number().integer().valid(0, 1).optional(),
      allowAllRole: Joi.number().integer().valid(0, 1).optional(),
      allowAllRoute: Joi.number().integer().valid(0, 1).optional(),
      allowProductExecutionUpdate: Joi.number()
        .integer()
        .valid(0, 1)
        .optional(),
    })
    .or(
      "allowedUserType",
      "allowAllStatus",
      "allowAllRole",
      "allowAllRoute",
      "allowProductExecutionUpdate"
    )
    .required(),
  nonce: Joi.string().optional(),
});

const roleShowSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  roleId: Joi.number().min(1).optional(),
  nonce: Joi.string().optional(),
});

const lotInsertSchema = Joi.object()
  .keys({
    userId: Joi.number().integer().min(1).required(),
    sessionId: Joi.string().required(),
    lotName: Joi.string().required(),
    productId: Joi.number().integer().min(1).optional(),
    packageId: Joi.number().integer().min(1).optional(),
    noOfCards: Joi.number().integer().min(1).required(),
    cardValue: Joi.number().required(),
    salesValue: Joi.number().required(),
    currencyId: Joi.number().min(1).required(),
    validationPeriod: Joi.number().integer().min(1).required(),
    activeValueType: Joi.number().valid(0, 1, 2).optional().default(0),
    addOns: Joi.array()
      .items(
        Joi.object()
          .keys({
            productId: Joi.number().integer().min(1).optional(),
            packageId: Joi.number().integer().min(1).optional(),
          })
          .xor("productId", "packageId")
      )
      .optional(),
    nonce: Joi.string().optional(),
  })
  .xor("productId", "packageId");

const lotUpdateSchema = Joi.object()
  .keys({
    userId: Joi.number().integer().min(1).required(),
    sessionId: Joi.string().required(),
    lotId: Joi.number().required(),
    lotName: Joi.string().optional(),
    productId: Joi.number().integer().min(1).optional(),
    packageId: Joi.number().integer().min(1).optional(),
    noOfCards: Joi.number().integer().min(1).optional(),
    cardValue: Joi.number().optional(),
    salesValue: Joi.number().optional(),
    currencyId: Joi.number().min(1).optional(),
    validationPeriod: Joi.number().integer().min(1).optional(),
    activeValueType: Joi.number().valid(0, 1).optional(),
    addOns: Joi.array()
      .items(
        Joi.object()
          .keys({
            productId: Joi.number().integer().min(1).optional(),
            packageId: Joi.number().integer().min(1).optional(),
            action: Joi.number().integer().valid(0, 1).optional().default(1),
          })
          .xor("productId", "packageId")
      )
      .optional(),
    nonce: Joi.string().optional(),
  })
  .or(
    "lotName",
    "productId",
    "packageId",
    "noOfCards",
    "cardValue",
    "salesValue",
    "currencyId",
    "validationPeriod",
    "activeValueType",
    "addOns"
  );

const lotDeleteSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  lotId: Joi.number().min(1).required(),
  nonce: Joi.string().optional(),
});

const lotShowSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  filters: Joi.object()
    .keys({
      lotId: Joi.number().integer().min(1).optional(),
      startDate: Joi.date()
        .format("YYYY-MM-DD")
        .options({
          convert: true,
        })
        .optional(),
      endDate: Joi.date()
        .format("YYYY-MM-DD")
        .min(Joi.ref("startDate"))
        .options({
          convert: true,
        })
        .optional(),
      timezone: Joi.string().required(),
    })
    .required(),
  nonce: Joi.string().optional(),
});

const lotDetailsSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  purpose: Joi.number().integer().valid(0, 1, 2, 3).required(),
  status: Joi.number()
    .when("purpose", {
      is: 0,
      then: Joi.number().integer().valid(0, 1).required(),
    })
    .when("purpose", {
      is: 1,
      then: Joi.number().integer().valid(0, 1).optional(),
    })
    .when("purpose", {
      is: 2,
      then: Joi.number().integer().valid(0, 1).optional(),
    })
    .when("purpose", {
      is: 3,
      then: Joi.number().integer().valid(0, 1).optional(),
    }),
  lotId: Joi.number().integer().min(1).optional(),
  startSerialNo: Joi.number().integer().min(1).optional(),
  noOfCards: Joi.number().integer().min(1).optional(),
  batchSize: Joi.number().integer().min(1).optional(),
  nonce: Joi.string().optional(),
});

const cardOrderSchema = Joi.object()
  .keys({
    userId: Joi.number().integer().min(1).optional(),
    sessionId: Joi.string().optional(),
    mobileNo: Joi.string()
      .regex(/^[0-9]{1,20}$/)
      .required(),
    pin: Joi.string().min(4).required(),
    channel: Joi.string().required(),
    productId: Joi.number().min(1).optional(),
    nonce: Joi.string().optional(),
  })
  .with("userId", "sessionId");

const cardSavePromoUserInfoSchema = Joi.object()
  .keys({
    userId: Joi.number().integer().min(1).optional(),
    sessionId: Joi.string().optional(),
    transactionId: Joi.string().max(64).required(),
    mobileNo: Joi.string()
      .regex(/^[0-9]{1,20}$/)
      .required(),
    pin: Joi.string().min(4).required(),
    userInput: Joi.string().max(64).required(),
    nonce: Joi.string().optional(),
  })
  .with("userId", "sessionId");

const cardGeneratePinSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  productId: Joi.number().min(1).required(),
  productCategoryId: Joi.number().integer().min(1).required(),
  amount: Joi.number().positive().required(),
  noOfPins: Joi.number().integer().min(1).max(20).optional(),
  generationChannel: Joi.string().valid("charlie", "platform").optional(),
  channel: Joi.string().required(),
  password: Joi.string().optional(),
  nonce: Joi.string().optional(),
});

const cardGenerateVoucherSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  productId: Joi.number().min(1).required(),
  productCategoryId: Joi.number().integer().min(1).required(),
  amount: Joi.number().positive().optional(),
  noOfPins: Joi.number().integer().min(1).max(20).optional(),
  channel: Joi.string().required(),
  password: Joi.string().optional(),
  nonce: Joi.string().optional(),
  paymentMethodId: Joi.number().integer().min(1).optional(),
});

const cardChangeStatusSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  startSerialNo: Joi.number().min(1).required(),
  noOfCards: Joi.number().min(1).required(),
  updatedStatus: Joi.number().integer().valid(0, 1).required(),
  nonce: Joi.string().optional(),
});

const cardSummarySchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  startSerialNo: Joi.number().min(1).required(),
  noOfCards: Joi.number().min(1).required(),
});

const cardOwnershipTransferInitiateSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  assignedTo: Joi.number()
    .integer()
    .min(1)
    .disallow(Joi.ref("userId"))
    .required(),
  startSerialNo: Joi.number().min(1).required(),
  transferSize: Joi.number().min(0).required(),
  nonce: Joi.string().optional(),
});

const cardOwnershipTransferActSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  ownershipTransferId: Joi.number().integer().min(1).required(),
  action: Joi.number().integer().valid(0, 1).required(),
  remarks: Joi.string().allow("").optional(),
  nonce: Joi.string().optional(),
});

const cardOwnershipTransferShowSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  filters: Joi.object()
    .keys({
      ownershipTransferId: Joi.number().integer().min(1).optional(),
      transferType: Joi.number().integer().valid(0, 1).optional(),
      assignedBy: Joi.number().integer().min(1).optional(),
      assignedTo: Joi.number().integer().min(1).optional(),
      status: Joi.number().integer().valid(0, 1, 2).optional(),
      startDate: Joi.date()
        .format("YYYY-MM-DD")
        .options({
          convert: true,
        })
        .optional(),
      endDate: Joi.date()
        .format("YYYY-MM-DD")
        .min(Joi.ref("startDate"))
        .options({
          convert: true,
        })
        .optional(),
    })
    .required(),
  timezone: Joi.string().required(),
  nonce: Joi.string().optional(),
});

const cardStatusSchema = Joi.object()
  .keys({
    userId: Joi.number().integer().min(1).optional(),
    sessionId: Joi.string().optional(),
    serialNo: Joi.string().optional(),
    pin: Joi.string().min(4).optional(),
    nonce: Joi.string().optional(),
  })
  .xor("serialNo", "pin");

const cardDownloadSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  lotId: Joi.number().min(1).required(),
  nonce: Joi.string().optional(),
});

const routeCreateSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  name: Joi.string().required(),
  addressLine1: Joi.string().max(64).optional(),
  addressLine2: Joi.string().max(64).optional(),
  addressLine3: Joi.string().max(64).optional(),
  city: Joi.string().max(64).optional(),
  zipCode: Joi.string().max(10).optional(),
  state: Joi.string().max(128).optional(),
  country: Joi.string().max(64).optional(),
  otherDetails: Joi.string().max(256).optional(),
});

const routeUpdateSchema = Joi.object()
  .keys({
    userId: Joi.number().integer().min(1).required(),
    sessionId: Joi.string().required(),
    routeId: Joi.number().integer().min(1).required(),
    name: Joi.string().optional(),
    status: Joi.number().integer().valid(0, 1).optional(),
    addressLine1: Joi.string().max(64).optional(),
    addressLine2: Joi.string().max(64).optional(),
    addressLine3: Joi.string().max(64).optional(),
    city: Joi.string().max(64).optional(),
    zipCode: Joi.string().max(10).optional(),
    state: Joi.string().max(128).optional(),
    country: Joi.string().max(64).optional(),
    otherDetails: Joi.string().max(256).optional(),
  })
  .or(
    "name",
    "status",
    "addressLine1",
    "addressLine2",
    "addressLine3",
    "city",
    "zipCode",
    "state",
    "country",
    "otherDetails"
  );

const routeDeleteSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  routeId: Joi.number().integer().min(1).required(),
});

const routeShowSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  routeId: Joi.number().integer().min(1).optional(),
});

const reportsGenerateSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  type: Joi.number().integer().min(1).required(),
  reportedUserId: Joi.number().integer().optional(),
  startDate: Joi.date()
    .format("YYYY-MM-DD")
    .options({
      convert: true,
    })
    .optional(),
  endDate: Joi.date()
    .format("YYYY-MM-DD")
    .min(Joi.ref("startDate"))
    .options({
      convert: true,
    })
    .optional(),
  timezone: Joi.string().required(),
  additionalFilters: Joi.object().optional(),
  cacheEnable: Joi.boolean().valid(true, false).optional().default(false),
});
const thirdPartyReportsGenerateSchema = Joi.object().keys({
  userId: Joi.string().required(),
  srcuid: Joi.string().required(),
  srcpwd: Joi.string().required(),

  reportedUserId: Joi.number().integer().optional(),
  startDate: Joi.date()
    .format("YYYY-MM-DD")
    .options({
      convert: true,
    })
    .optional(),
  endDate: Joi.date()
    .format("YYYY-MM-DD")
    .min(Joi.ref("startDate"))
    .options({
      convert: true,
    })
    .optional(),
  timezone: Joi.string().required(),
  additionalFilters: Joi.object().optional(),
  cacheEnable: Joi.boolean().valid(true, false).optional().default(false),
});

const thirdPartyOperatorIndentifySchema = Joi.object().keys({
  srcuid: Joi.string().required(),
  srcpwd: Joi.string().required(),
  mobileNo: Joi.string().required(),
  country: Joi.string().required(),
});

const reportsDownloadSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  fileType: Joi.string().valid("xlsx", "csv").required(),
  type: Joi.number().integer().min(1).required(),
  name: Joi.string().required(),
  reportedUserId: Joi.number().integer().optional(),
  startDate: Joi.date()
    .format("YYYY-MM-DD")
    .options({
      convert: true,
    })
    .optional(),
  endDate: Joi.date()
    .format("YYYY-MM-DD")
    .min(Joi.ref("startDate"))
    .options({
      convert: true,
    })
    .optional(),
  timezone: Joi.string().required(),
  excludes: Joi.array().items(Joi.number().integer().min(0)).optional(),
  additionalFilters: Joi.object().optional(),
});

const salesCreationSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  salesUserId: Joi.number().integer().required(),
  type: Joi.number().integer().valid(0, 1, 2, 3, 4).required(),
  status: Joi.number().integer().valid(0, 1, 2).optional(),
  amount: Joi.number().positive().precision(2).optional(),
  comission: Joi.number().min(0).precision(2).optional(),
  discount: Joi.number().min(0).precision(2).optional(),
  amountPaid: Joi.number().min(0).precision(2).optional(),
  salesDiscount: Joi.number().min(0).precision(2).optional(), // In percentage.
  tax: Joi.number().min(0).precision(2).optional(), // In percentage.
  paymentType: Joi.number().integer().valid(0, 1, 2).optional(),
  channel: Joi.string().required(),
  lineItems: Joi.array()
    .items(
      Joi.object()
        .keys({
          productId: Joi.number().integer().min(1).optional(),
          packageId: Joi.number().integer().min(1).optional(),
          startSerialNo: Joi.number().integer().min(1).optional(),
          quantity: Joi.number().integer().optional().default(1),
        })
        .xor("productId", "packageId")
    )
    .optional(),
  resources: Joi.array()
    .items(
      Joi.object().keys({
        name: Joi.string().valid("deposit-slip-pic").required(),
        contentId: Joi.string().required(),
      })
    )
    .optional(),
  depositSlipDate: Joi.date()
    .format("YYYY-MM-DD")
    .options({
      convert: true,
    })
    .optional(), // No validation!
  nonce: Joi.string().optional(),
});
const salesOrderCreationPortalSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  salesUserId: Joi.number().integer().required(),
  transferTo: Joi.number().integer().required(),
  transferFrom: Joi.number().integer().optional(),
  currencyId: Joi.number().integer().optional(),
  type: Joi.number().integer().valid(0, 1, 2, 3, 4).required(),
  orderType: Joi.number().integer().valid(1, 2, 3).required(),
  status: Joi.number().integer().valid(0, 1, 2).optional(),
  amount: Joi.number().integer().precision(2).optional(),
  comission: Joi.number().min(0).precision(2).optional(),
  discount: Joi.number().min(0).precision(2).optional(),
  amountPaid: Joi.number().min(0).precision(2).required(),
  salesDiscount: Joi.number().min(0).precision(2).optional(), // In percentage.
  tax: Joi.number().min(0).precision(2).optional(), // In percentage.
  paymentType: Joi.number().integer().valid(0, 1, 2).optional(),
  transfer_channel: Joi.string().required(),
  deposit_slip: Joi.string().optional(),
  lineItems: Joi.array()
    .items(
      Joi.object()
        .keys({
          productId: Joi.number().integer().min(1).optional(),
          packageId: Joi.number().integer().min(1).optional(),
          startSerialNo: Joi.number().integer().min(1).optional(),
          quantity: Joi.number().integer().optional().default(1),
        })
        .xor("productId", "packageId")
    )
    .optional(),

  depositSlipDate: Joi.date()
    .format("YYYY-MM-DD")
    .options({
      convert: true,
    })
    .optional(), // No validation!
  nonce: Joi.string().optional(),
});

const salesShowSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  filters: Joi.object()
    .keys({
      salesParentId: Joi.number().integer().min(1).optional(),
      salesUserId: Joi.number().integer().min(1).optional(),
      salesOrderType: Joi.number().integer().valid(0, 1, 2).optional(),
      salesOrderStatus: Joi.number().integer().valid(0, 1, 2).optional(),
      salesOrderId: Joi.number().integer().min(1).optional(),
      startDate: Joi.date()
        .format("YYYY-MM-DD")
        .options({
          convert: true,
        })
        .optional(),
      endDate: Joi.date()
        .format("YYYY-MM-DD")
        .min(Joi.ref("startDate"))
        .options({
          convert: true,
        })
        .optional(),
      timezone: Joi.string().required(),
    })
    .required(),
  nonce: Joi.string().optional(),
});

const salesApproveSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  salesOrderId: Joi.number().integer().min(1).required(),
  action: Joi.number().integer().valid(0, 1, 2).required(),
  note: Joi.string().max(256).allow("").optional(),
  description: Joi.string().max(256).allow("").optional(),
  nonce: Joi.string().optional(),
});

const fundTransferConfigCreateSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  from: Joi.number().integer().min(1).required(),
  to: Joi.number().integer().min(1).required(),
  productId: Joi.number().integer().min(0).optional(),
  isAllowed: Joi.number().integer().valid(0, 1).optional(),
  allowType: Joi.number().integer().valid(0, 1, 2, 3).optional(),
  comission: Joi.number().precision(2).required(),
  nonce: Joi.string().optional(),
});

const fundTransferConfigUpdateSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  configId: Joi.number().integer().min(1).required(),
  updatedFields: Joi.object()
    .keys({
      productId: Joi.number().integer().min(0).optional(),
      status: Joi.number().integer().valid(0, 1).optional(),
      isAllowed: Joi.number().integer().valid(0, 1).optional(),
      allowType: Joi.number().integer().valid(0, 1, 2, 3).optional(),
      comission: Joi.number().precision(2).optional(),
    })
    .or("productId", "status", "isAllowed", "allowType", "comission")
    .required(),
  nonce: Joi.string().optional(),
});

const fundTransferConfigShowSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  configId: Joi.number().integer().min(1).optional(),
  nonce: Joi.string().optional(),
});

const depositSlipsSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  year: Joi.number().integer().optional(),
  month: Joi.number().integer().min(0).max(11).optional(),
});

const adminBalanceSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  amount: Joi.number().positive().min(1).required(),
  channel: Joi.string().required(),
});

const getDiscountListSchema = Joi.object().keys({
  userId: Joi.number().integer().required(),
  sessionId: Joi.string().required(),
  filters: Joi.object()
    .keys({
      userId: Joi.number().integer().required(),
      categoryId: Joi.number().integer().min(1).required(),
    })
    .required(),
});

const currencyCreateSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  currencyName: Joi.string().max(10).required(),
  currencyDescription: Joi.string().max(1024).optional(),
  currencyConversionRate: Joi.number().positive().precision(2).required(),
  countryName: Joi.string().max(1024).required(),
  countryCode: Joi.string().max(10).required(),
  isoAlpha2Code: Joi.string().max(5).required(),
});

const currencyUpdateSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  currencyId: Joi.number().integer().min(1).required(),
  updatedFields: Joi.object()
    .keys({
      currencyName: Joi.string().max(10).optional(),
      currencyDescription: Joi.string().max(1024).optional(),
      status: Joi.number().integer().valid(0, 1).optional(),
      currencyConversionRate: Joi.number().positive().precision(2).optional(),
      countryName: Joi.string().max(1024).optional(),
      countryCode: Joi.string().max(10).optional(),
      isoAlpha2Code: Joi.string().max(5).optional(),
    })
    .required()
    .or(
      "currencyName",
      "currencyDescription",
      "status",
      "currencyConversionRate",
      "countryName",
      "countryCode",
      "isoAlpha2Code"
    ),
});

const currencyShowSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  currencyId: Joi.number().integer().min(1).optional(),
});

const configurationCreateSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  configType: Joi.string()
    .valid("Text", "Number", "Date", "Notification")
    .required(),
  configName: Joi.string().max(256).required(),
  configDescription: Joi.string().max(1024).optional(),
  configValue: Joi.string().max(1024).required(),
  isConfigEditable: Joi.number().integer().valid(0, 1).optional(),
  isConfigViewable: Joi.number().integer().valid(0, 1).optional(),
  nonce: Joi.string().optional(),
});

const configurationUpdateSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  configId: Joi.number().integer().min(1).required(),
  updatedFields: Joi.object()
    .keys({
      configType: Joi.string().valid("Text", "Number", "Date").optional(),
      configName: Joi.string().max(256).optional(),
      configDescription: Joi.string().max(1024).optional(),
      configValue: Joi.string().max(256).optional(),
      isConfigEditable: Joi.number().integer().valid(0, 1).optional(),
      isConfigViewable: Joi.number().integer().valid(0, 1).optional(),
    })
    .required()
    .or(
      "configType",
      "configName",
      "configDescription",
      "configValue",
      "isConfigEditable",
      "isConfigViewable"
    ),
  nonce: Joi.string().optional(),
});

const configurationShowSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  configId: Joi.number().integer().min(1).optional(),
  configType: Joi.string()
    .valid("Text", "Number", "Date", "Notification")
    .optional(),
});

const productCategoryShowSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  productCategoryId: Joi.number().integer().min(1).optional(),
  nonce: Joi.string().optional(),
});

const stockInfoSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
});

const storeDeviceSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  lotId: Joi.number().integer().min(1).required(),
  deviceList: Joi.array().items(Joi.array().items().min(2)).min(1).required(),
  nonce: Joi.string().optional(),
});

const deviceLotShowSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
});

const showDeviceSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  productId: Joi.number().integer().min(1).optional(),
  startSerialNo: Joi.number().integer().min(1).optional(),
  noOfCards: Joi.number().integer().min(1).optional(),
  batchSize: Joi.number().integer().min(1).optional(),
  nonce: Joi.string().optional(),
});

const deviceOwnershipTransferSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  assignedTo: Joi.number()
    .integer()
    .min(1)
    .disallow(Joi.ref("userId"))
    .required(),
  transferList: Joi.array()
    .items(
      Joi.object().keys({
        startSerialNo: Joi.number().min(1).required(),
        transferSize: Joi.number().min(0).required(),
      })
    )
    .required(),
  nonce: Joi.string().optional(),
});

const deviceOwnershipTransferShowSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  showType: Joi.string().valid("RECEIVED", "TRANSFERRED").required(),
  queriedUserId: Joi.number().integer().min(1).optional(),
  nonce: Joi.string().optional(),
});

const deviceOwnershipTransferDetailsSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  transferId: Joi.number().integer().min(1).required(),
  nonce: Joi.string().optional(),
});

const yankeeCardOwnershipTransferSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  assignedTo: Joi.number()
    .integer()
    .min(1)
    .disallow(Joi.ref("userId"))
    .required(),
  transferList: Joi.array()
    .items(
      Joi.object().keys({
        startSerialNo: Joi.number().min(1).required(),
        transferSize: Joi.number().min(0).required(),
      })
    )
    .required(),
});

const yankeeCardFlowSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  mobileNo: Joi.string()
    .regex(/^[0-9]{1,20}$/)
    .required(),
  type: Joi.string().valid("activation", "order").required(),
  retailerId: Joi.number()
    .when("type", {
      is: "activation",
      then: Joi.number().integer().min(1).required(),
    })
    .when("type", {
      is: "order",
      then: Joi.number().optional(),
    }),
  serialNo: Joi.number()
    .when("type", {
      is: "activation",
      then: Joi.number().integer().min(1).required(),
    })
    .when("type", {
      is: "order",
      then: Joi.number().optional(),
    }),
  pin: Joi.string()
    .when("type", {
      is: "activation",
      then: Joi.string().optional(),
    })
    .when("type", {
      is: "order",
      then: Joi.string().max(128).required(),
    }),
});

const yankeeCardStatusSchema = Joi.object()
  .keys({
    userId: Joi.number().integer().min(1).required(),
    sessionId: Joi.string().required(),
    serialNo: Joi.number().integer().min(1).optional(),
    pin: Joi.string().optional(),
  })
  .xor("serialNo", "pin");

const yankeeCardReportsSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  filters: Joi.object()
    .keys({
      retailerId: Joi.number().integer().min(1).optional(),
    })
    .optional(),
});

const yankeeCardReportsDetailsSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  retailerId: Joi.number().integer().min(1).required(),
  status: Joi.number().integer().valid(0, 1, 2).required(),
});

const bdOrderSchema = Joi.object().keys({
  srcuid: Joi.string().max(128).required(),
  srcpwd: Joi.string().max(128).required(),
  msisdn: Joi.string().max(20).required(),
  amount: Joi.number().positive().required(),
  operator: Joi.string().max(128).required(),
  customer_tid: Joi.string().max(64).optional(),
  type: Joi.string().valid("PREPAID", "POSTPAID").required(),
  nonce: Joi.string().optional(),
});

const topUpCheckSchema = Joi.object().keys({
  srcuid: Joi.string().max(128).required(),
  srcpwd: Joi.string().max(128).required(),
  amount: Joi.number().positive().required(),
  operator: Joi.string().max(128).required(),
  country: Joi.string().max(128).required(),
  type: Joi.string().valid("PREPAID", "POSTPAID").optional(),
  nonce: Joi.string().optional(),
});

const topUpRequestSchema = Joi.object().keys({
  srcuid: Joi.string().max(128).required(),
  srcpwd: Joi.string().max(128).required(),
  msisdn: Joi.string().max(20).required(),
  amount: Joi.number().positive().required(),
  operator: Joi.string().max(128).required(),
  country: Joi.string().max(128).required(),
  type: Joi.string().valid("PREPAID", "POSTPAID").optional(),
  customer_tid: Joi.string().max(64).optional(),
  nonce: Joi.string().optional(),
});
const digiAccountBalanceAddRequestSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  amount: Joi.number().positive().required(),
  digiMobileNumber: Joi.string().max(64).required(),
  channel: Joi.string().max(64).optional(),
  nonce: Joi.string().optional(),
});
const digiVoiceTopUpRequestSchema = Joi.object().keys({
  srcuid: Joi.string().max(128).required(),
  srcpwd: Joi.string().max(128).required(),
  msisdn: Joi.string().max(20).required(),
  amount: Joi.number().positive().required(),
  operator: Joi.string().max(128).required(),
  country: Joi.string().max(128).required(),
  type: Joi.string().valid("PREPAID", "POSTPAID").optional(),
  customer_tid: Joi.string().max(64).required(),
  channel: Joi.string().max(64).optional(),
  walletTypeId: Joi.string().max(64).required(),
  nonce: Joi.string().optional(),
});

const datapackListSchema = Joi.object().keys({
  srcuid: Joi.string().max(128).required(),
  srcpwd: Joi.string().max(128).required(),
  country: Joi.string().max(128).optional(),
  nonce: Joi.string().optional(),
});

const datapackCheckSchema = Joi.object().keys({
  srcuid: Joi.string().max(128).required(),
  srcpwd: Joi.string().max(128).required(),
  datapack_id: Joi.number().integer().min(1).required(),
  nonce: Joi.string().optional(),
});

const datapackRequestSchema = Joi.object().keys({
  srcuid: Joi.string().max(128).required(),
  srcpwd: Joi.string().max(128).required(),
  msisdn: Joi.string().max(20).required(),
  datapack_id: Joi.number().integer().min(1).required(),
  customer_tid: Joi.string().max(64).optional(),
  nonce: Joi.string().optional(),
});
const digiVoicedatapackRequestSchema = Joi.object().keys({
  srcuid: Joi.string().max(128).required(),
  srcpwd: Joi.string().max(128).required(),
  msisdn: Joi.string().max(20).required(),
  datapack_id: Joi.number().integer().min(1).required(),
  customer_tid: Joi.string().max(64).required(),
  channel: Joi.string().optional(),
  walletTypeId: Joi.string().max(64).required(),
  nonce: Joi.string().optional(),
});

const orderStatusSchema = Joi.object()
  .keys({
    srcuid: Joi.string().max(128).required(),
    srcpwd: Joi.string().max(128).required(),
    tid: Joi.string().max(64).optional(),
    customer_tid: Joi.string().max(64).optional(),
    nonce: Joi.string().optional(),
  })
  .or("tid", "customer_tid");

const platformGetBalanceSchema = Joi.object().keys({
  srcuid: Joi.string().max(128).required(),
  srcpwd: Joi.string().max(128).required(),
  nonce: Joi.string().optional(),
});

const countryBOrderSchema = Joi.object().keys({
  srcuid: Joi.string().max(128).required(),
  srcpwd: Joi.string().max(128).required(),
  msisdn: Joi.string().max(20).required(),
  amount: Joi.number().positive().required(),
  operator_code: Joi.string().max(128).required(),
  nonce: Joi.string().optional(),
});

const countryBOrderStatusSchema = Joi.object().keys({
  srcuid: Joi.string().max(128).required(),
  srcpwd: Joi.string().max(128).required(),
  tid: Joi.string().max(64).required(),
  nonce: Joi.string().optional(),
});

const transactionCommissionUpdateSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  transactionCommissionId: Joi.number().integer().min(1).required(),
  status: Joi.number().integer().valid(0, 1, 2).required(),
  remarks: Joi.string().max(1024).required(),
  nonce: Joi.string().optional(),
});

const promoCreateSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  type: Joi.number().integer().min(0).required(),
  text: Joi.string().max(1024).required(),
  maskingText: Joi.string().max(1024).required(),
  startTime: Joi.date().required(),
  endTime: Joi.date().required(),
  nonce: Joi.string().optional(),
});

const promoUpdateSchema = Joi.object()
  .keys({
    userId: Joi.number().integer().min(1).required(),
    sessionId: Joi.string().required(),
    promoId: Joi.number().integer().min(1).required(),
    type: Joi.number().integer().min(0).optional(),
    text: Joi.string().max(1024).optional(),
    maskingText: Joi.string().max(1024).optional(),
    startTime: Joi.date().optional(),
    endTime: Joi.date().optional(),
    nonce: Joi.string().optional(),
  })
  .or("type", "text", "maskingText", "startTime", "endTime");

const promoShowSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  promoId: Joi.number().integer().min(1).optional(),
});

const jompayCallbackSchema = Joi.object().keys({
  header: Joi.object().keys({
    sig: Joi.string().max(100).required(),
    timestamp: Joi.date().required(),
  }),
  body: Joi.object().keys({
    payerbanknum: Joi.string().max(10).optional(),
    payerbankname: Joi.string().max(20).optional(),
    billerbanknum: Joi.string().max(10).optional(),
    billerbankname: Joi.string().max(20).optional(),
    accounttype: Joi.string().max(5).optional(),
    billercode: Joi.string().max(10).optional(),
    billercodename: Joi.string().max(50).optional(),
    nbpsref: Joi.string().max(20).optional(),
    channel: Joi.string().max(5).optional(),
    debittimestamp: Joi.string().max(50).optional(),
    repeatmsg: Joi.string().max(1).allow([null, ""]).optional(),
    rrn: Joi.string().max(50).allow([null, ""]).required(),
    rrn2: Joi.string().max(50).allow([null, ""]).optional(),
    currencycode: Joi.string().max(3).optional(),
    amount: Joi.number().required(),
    extdata: Joi.string().max(250).allow([null, ""]).optional(),
  }),
});

const jompayIssueApproveRejectSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  issueId: Joi.number().integer().min(1).required(),
  action: Joi.string().valid("approve", "reject").required(),
  reason: Joi.string().allow([null, ""]).required(),
});

const jompayIssueManualValidationSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  issueId: Joi.number().integer().min(1).required(),
  jompayRefNumber: Joi.string().required(),
});

const platformBotLogoutSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  messengerUserId: Joi.string().required(),
  nonce: Joi.string().optional(),
  language: Joi.string().optional(),
});

const platformBotCardPinProductInfoSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  productId: Joi.number().min(1).required(),
  language: Joi.string().optional(),
});

const platformBotCardPinGenerateCheckSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  productId: Joi.number().min(1).required(),
  amount: Joi.number().positive().required(),
  noOfPins: Joi.number().integer().min(1).max(20).optional(),
  language: Joi.string().optional(),
});

const platformBotCardPinGenerateSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  productId: Joi.number().min(1).required(),
  amount: Joi.number().positive().required(),
  noOfPins: Joi.number().integer().min(1).max(20).optional(),
  language: Joi.string().optional(),
});

const platformBotCardOrderSchema = Joi.object().keys({
  mobileNo: Joi.string().max(20).required(),
  pin: Joi.string().max(128).required(),
  language: Joi.string().optional(),
});

const platformBotCardInquirySchema = Joi.object().keys({
  pin: Joi.string().max(128).required(),
  language: Joi.string().optional(),
});

const platformBotCardSavePromoInfoSchema = Joi.object().keys({
  transactionId: Joi.string().max(128).required(),
  mobileNo: Joi.string().max(20).required(),
  pin: Joi.string().max(128).required(),
  userInput: Joi.string().max(128).required(),
  language: Joi.string().optional(),
});

const platformBotDialerOrderRequestCheckSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  dialerId: Joi.string()
    .regex(/^[0-9]{1,20}$/)
    .required(),
  amount: Joi.number().positive().precision(2).required(),
  language: Joi.string().optional(),
});

const platformBotDialerOrderRequestSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  dialerId: Joi.string()
    .regex(/^[0-9]{1,20}$/)
    .required(),
  amount: Joi.number().positive().precision(2).required(),
  language: Joi.string().optional(),
});

const platformBotTopUpRequestCheckSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  productId: Joi.number().integer().min(1).required(),
  amount: Joi.number().positive().precision(2).required(),
  language: Joi.string().optional(),
});

const platformBotTopUpRequestProductInfoSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  productId: Joi.number().min(1).required(),
  language: Joi.string().optional(),
});

const platformBotTopUpRequestSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  productId: Joi.number().integer().min(1).required(),
  amount: Joi.number().positive().precision(2).required(),
  mobileNo: Joi.string().max(20).required(),
  language: Joi.string().optional(),
});

const platformBotDatapackListSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  country: Joi.string().max(128).required(),
  operator: Joi.string().max(128).required(),
  language: Joi.string().optional(),
});

const platformBotDatapackRequestCheckSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  productId: Joi.number().integer().min(1).required(),
  language: Joi.string().optional(),
});

const platformBotDatapackRequestSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  productId: Joi.number().integer().min(1).required(),
  mobileNo: Joi.string().max(20).required(),
  language: Joi.string().optional(),
});

const platformBotFundTransferCheckSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  transferTo: Joi.number()
    .integer()
    .min(1)
    .disallow(Joi.ref("userId"))
    .required(),
  amount: Joi.number().min(10).max(100000).required(),
  language: Joi.string().optional(),
});

const platformBotFundTransferSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  transferTo: Joi.number()
    .integer()
    .min(1)
    .disallow(Joi.ref("userId"))
    .required(),
  amount: Joi.number().min(10).max(100000).required(),
  language: Joi.string().optional(),
});

const redeemCardSchema = Joi.object().keys({
  pin: Joi.string().required(),
  referenceId: Joi.string().max(64).optional(),
});

const redeemCardStatusSchema = Joi.object().keys({
  pin: Joi.string().required(),
});
const bannerImageSchema = Joi.object().keys({
  userId: Joi.number().required(),
  app: Joi.number().required(),
  os: Joi.number().required(),
  loc: Joi.number().required(),
  ts: Joi.number().optional(),
  ref: Joi.string().max(64).optional(),
});
const tpBalanceCheeckSchema = Joi.object().keys({
  userId: Joi.string().required(),
  srcuid: Joi.string().required(),
  srcpwd: Joi.string().required(),
});
const voiceBalanceCheck = Joi.object().keys({
  userId: Joi.string().required(),
  srcuid: Joi.string().required(),
  srcpwd: Joi.string().required(),
});
const appTokenUpdateSchema = Joi.object().keys({
  userId: Joi.number().integer().min(0).required(),
  sessionId: Joi.string().required(),
  appToken: Joi.string().required(),

  nonce: Joi.string().optional(),
});
const salesTeamInfoSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
});
const lotDetailsSchemaForSalesPortal = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  startSerialNo: Joi.number().integer().min(1).optional(),
  purpose: Joi.number().integer().valid(0, 1, 2, 3).required(),
  status: Joi.number()
    .when("purpose", {
      is: 0,
      then: Joi.number().integer().valid(0, 1).required(),
    })
    .when("purpose", {
      is: 1,
      then: Joi.number().integer().valid(0, 1).optional(),
    })
    .when("purpose", {
      is: 2,
      then: Joi.number().integer().valid(0, 1).optional(),
    })
    .when("purpose", {
      is: 3,
      then: Joi.number().integer().valid(0, 1).optional(),
    }),
  lotId: Joi.number().integer().min(1).optional(),
  productId: Joi.number().integer().min(1).required(),
  noOfCards: Joi.number().integer().min(1).required(),
  batchSize: Joi.number().integer().min(1).optional(),
  nonce: Joi.string().optional(),
});
const sendOtpSchema = Joi.object().keys({
  countryCode: Joi.string().required(),
  mobileNo: Joi.string().max(20).required(),
  channel: Joi.string().max(20).required(),
  purpose: Joi.string()
    .valid(
      "login",
      "sign-up",
      "fund-transfer",
      "order-request",
      "platform-dialer",
      "add-balance",
      "soft-pin",
      "platform-cash",
      "bill-payment-request",
      // "forget-password",
      "platform-digi-payment",
      "general",
      "update-email"
    )
    .required(),
  nonce: Joi.string().optional(),
  clientApp: Joi.string().optional(),
  smsChannel: Joi.string().valid("general", "digi").optional(),
});

const voiceTopUpCheckSchema = Joi.object().keys({
  srcuid: Joi.string().max(128).required(),
  srcpwd: Joi.string().max(128).required(),
  amount: Joi.number().positive().required(),
  operator: Joi.string().max(128).required(),
  country: Joi.string().max(128).required(),
  type: Joi.string().valid("PREPAID", "POSTPAID").optional(),
  customer_tid: Joi.string().max(128).required(),
  channel: Joi.string().optional(),
  nonce: Joi.string().optional(),
});
const voiceDataUpCheckSchema = Joi.object().keys({
  srcuid: Joi.string().max(128).required(),
  srcpwd: Joi.string().max(128).required(),
  datapack_id: Joi.number().integer().min(1).required(),
  customer_tid: Joi.string().max(128).required(),
  channel: Joi.string().optional(),
  nonce: Joi.string().optional(),
});
const walletBalanceAddSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  amount: Joi.number().min(10).max(100000).required(),
  currencyId: Joi.number().min(1).required(),
  walletTypeId: Joi.number().min(1).required(),
  channel: Joi.string().optional(),
  requestedBy: Joi.string().optional(),
});
const walletBalanceAddSchemaPortal = Joi.object().keys({
  walletUserId: Joi.number().integer().min(1).required(),
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  amount: Joi.number().positive().max(100000).required(),
  currencyId: Joi.number().min(1).required(),
  walletTypeId: Joi.number().min(1).required(),
  channel: Joi.string().optional(),
  requestedBy: Joi.string().optional(),
});
const userMenuInfoSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  clientApp: Joi.string().optional(),
});

const pgwPaymentInitiateSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  currencyId: Joi.number().integer().min(1).required(),
  amount: Joi.number().positive().precision(2).required(),
  paymentType: Joi.string()
    .valid("online_banking", "debit_credit_card", "mobile_wallet")
    .optional(),
});
const pgwCheckOnlineSaleSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  currencyId: Joi.number().integer().min(1).required(),
});
const getMobileNumberInfo = Joi.object().keys({
  username: Joi.string().required(),
  channel: Joi.string().optional(),
});
const getPromotionsSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  amount: Joi.number().positive().precision(2).optional(),
  productId: Joi.number().integer().min(1).optional(),
  productCategoryId: Joi.when("productId", {
    is: "",
    then: Joi.number().integer().min(1).required(),
    otherwise: Joi.number().integer().min(1).optional(),
  }),
  /*
        productCategoryId: Joi.number().integer().min(1).optional(),
    */
  password: Joi.string().optional(),
  channel: Joi.string().required(),
});
const promotionsExecutionSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  productId: Joi.number().integer().min(1).optional(),
  productCategoryId: Joi.when("productId", {
    is: "",
    then: Joi.number().integer().min(1).required(),
    otherwise: Joi.number().integer().min(1).optional(),
  }),
  promotionId: Joi.number().integer().min(1).required(),
  channel: Joi.string().required(),
});
const zuluCouponExecutionSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  productId: Joi.number().integer().min(1).required(),
  productCategoryId: Joi.number().integer().min(1).optional(),
  amount: Joi.number().positive().precision(2).optional(),
  channel: Joi.string().required(),
  walletTypeId: Joi.number().integer().min(1).optional(),
  paymentMethodId: Joi.number().integer().min(1).optional(),
});

const referralAddBalanceSchema = Joi.object()
  .keys({
    srcuid: Joi.string().max(128).required(),
    srcpwd: Joi.string().max(128).required(),
    platformUserId: Joi.number().min(1).required(),
    referredTo: Joi.number().min(1).optional(),
    amount: Joi.number().positive().required(),
    productId: Joi.number().min(1).optional(),
    packageId: Joi.number().min(1).optional(),
    walletTypeId: Joi.number().min(1).optional(),
    channel: Joi.string().required(),
    referenceId: Joi.string().required(),
  })
  .or("productId", "packageId");

const referralUsersRoleSchema = Joi.object().keys({
  srcuid: Joi.string().max(128).required(),
  srcpwd: Joi.string().max(128).required(),
  platformUserIds: Joi.array()
    .items(Joi.number().min(1).required())
    .min(1)
    .required(),
});

const referralCreateLinkSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  appName: Joi.string().required(),
  channel: Joi.string().valid("android", "ios", "web").required(),
});

const referralAddUser = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  referredUserId: Joi.number().integer().min(1).required(),
});

const thirdPartyAddBalaneSchema = Joi.object().keys({
  srcuid: Joi.string().max(128).required(),
  srcpwd: Joi.string().max(128).required(),
  amount: Joi.number().positive().max(100000).required(),
  usernameForBalanceAdd: Joi.string().max(128).required(),
  walletTypeId: Joi.number().min(1).optional(),
  channel: Joi.string().required(),
  currencyCode: Joi.string().required(),
  transactionRef: Joi.string().required(),
});

const tpProductListSchema = Joi.object().keys({
  srcuid: Joi.string().required(),
  srcpwd: Joi.string().required(),
  filters: Joi.object()
    .keys({
      productId: Joi.number().integer().min(1).optional(),
      categoryId: Joi.number().integer().min(1).optional(),
      countryCode: Joi.string().min(1).max(10).optional(),
    })
    .required(),
  nonce: Joi.string().optional(),
});

const tpBillPaymentInfoSchema = Joi.object().keys({
  srcuid: Joi.string().max(128).required(),
  srcpwd: Joi.string().max(128).required(),
  productId: Joi.number().integer().min(1).required(),
  additionalData: Joi.object().optional(),
  nonce: Joi.string().optional(),
});

const tpBillPaymentRequestSchema = Joi.object().keys({
  srcuid: Joi.string().max(128).required(),
  srcpwd: Joi.string().max(128).required(),
  clientRefId: Joi.string().max(128).required(),
  productId: Joi.number().integer().min(1).required(),
  amount: Joi.number().positive().precision(2).optional(),
  additionalData: Joi.object().optional(),
});

const zuluSubscriptionSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  productId: Joi.number().integer().min(1).required(),
  mobileNo: Joi.string()
    .regex(/^[0-9]{1,20}$/)
    .required(),
  amount: Joi.number().positive().precision(2).optional(),
  channel: Joi.string().required(),
  walletTypeId: Joi.number().min(1).optional(),
  password: Joi.string().optional(),
});

const voiceZuluRequest = Joi.object().keys({
  srcuid: Joi.string().max(128).required(),
  srcpwd: Joi.string().max(128).required(),
  msisdn: Joi.string().max(20).required(),
  productId: Joi.number().integer().min(1).required(),
  customer_tid: Joi.string().max(64).required(),
  walletTypeId: Joi.number().optional(),
});

const promotionsSubscriptionSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  productId: Joi.number().integer().min(1).required(),
  productCategoryId: Joi.when("productId", {
    is: "",
    then: Joi.number().integer().min(1).required(),
    otherwise: Joi.number().integer().min(1).optional(),
  }),
  mobileNo: Joi.string()
    .regex(/^[0-9]{1,20}$/)
    .required(),
  promotionId: Joi.number().integer().min(1).required(),
  channel: Joi.string().required(),
});

const bannerCreateSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  bannerType: Joi.number().integer().valid(-1, 0, 1, 2).required(),
  title: Joi.string().max(255).optional(),
  subTitle: Joi.string().max(1024).optional(),
  description: Joi.string().max(1024).optional(),
  resources: Joi.object()
    .keys({
      name: Joi.string().valid("banner-pic").required(),
      contentId: Joi.string().required(),
    })
    .required(),
  deepLink: Joi.string().max(1024).required(),
  roleId: Joi.number().integer().min(0).optional(),
  nationality: Joi.string().max(128).optional(),
  channel: Joi.string().max(20).optional(),
});

const bannerUpdateSchema = Joi.object()
  .keys({
    userId: Joi.number().integer().min(1).required(),
    sessionId: Joi.string().required(),
    bannerId: Joi.number().integer().min(1).required(),
    bannerType: Joi.number().integer().valid(-1, 0, 1, 2).optional(),
    title: Joi.string().max(255).optional(),
    subTitle: Joi.string().max(1024).optional(),
    description: Joi.string().max(1024).optional(),
    status: Joi.number().integer().valid(0, 1).optional(),
    resources: Joi.object()
      .keys({
        name: Joi.string().valid("banner-pic").required(),
        contentId: Joi.string().required(),
      })
      .optional(),
    deepLink: Joi.string().max(1024).optional(),
    roleId: Joi.number().integer().min(0).optional(),
    nationality: Joi.string().max(128).optional(),
    channel: Joi.string().max(20).optional(),
  })
  .or(
    "bannerType",
    "title",
    "subTitle",
    "description",
    "status",
    "resources",
    "deepLink",
    "roleId",
    "nationality",
    "channel"
  );

const bannerListSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  filters: Joi.object()
    .keys({
      bannerId: Joi.number().integer().min(1).optional(),
      roleId: Joi.number().integer().min(0).optional(),
      nationality: Joi.string().max(128).optional(),
      channel: Joi.string().max(20).optional(),
    })
    .required(),
});

const nearbyAgentsRequestSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
});

const notificationSchema = Joi.object().keys({
  userNameOrId: Joi.any().required(),
  title: Joi.string().required(),
  body: Joi.string().required(),
  srcuid: Joi.string().max(128).required(),
  srcpwd: Joi.string().max(128).required(),
});

const changePhoneNumberSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  password: Joi.string().required(),
  mobileNo: Joi.string()
    .regex(/^[0-9]{1,20}$/)
    .required(),
  countryCode: Joi.string().min(1).max(10).required(),
  clientApp: Joi.string().optional(),
});

const changeEmailSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  email: Joi.string().required(),
});

const deviceRegistrationSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  deviceId: Joi.string().optional(),
  deviceName: Joi.string().optional(),
  sessionId: Joi.string().required(),
});

const deleteDeviceSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  deviceId: Joi.string().required(),
  sessionId: Joi.string().required(),
});

const fetchDeviceListSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
});

const inAppNotificationSchema = Joi.object().keys({
  src: Joi.string().required(),
  from: Joi.number().integer().min(0).required(),
  to: Joi.object().keys({
    token: Joi.array().items(Joi.string()),
  }),
  data: Joi.object().keys({
    body: Joi.string().required(),
    title: Joi.string().required(),
    userId: Joi.string().min(1).required(),
    deepLink: Joi.string().allow(null).allow("").optional(),
    icon: Joi.string().allow(null).allow("").optional(),
  }),
  type: Joi.string().required(),
  refID: Joi.string().required(),
  serviceID: Joi.string().required(),
  remark: Joi.string().allow(null).allow("").optional(),
  additionalProperty: Joi.object()
    .keys({
      retry: Joi.array().items(Joi.string()),
    })
    .allow(null)
    .allow("")
    .optional(),
});

const getInAppNotifications = Joi.object().keys({
  userId: Joi.number().integer().min(0).required(),
  sessionId: Joi.string().required(),
  offsetX: Joi.number().required(),
});

const checkValidPartnerNumber = Joi.object().keys({
  msisdn: Joi.string().required(),
});

const tngDataUpCheckSchema = Joi.object().keys({
  srcuid: Joi.string().max(128).required(),
  srcpwd: Joi.string().max(128).required(),
  datapack_id: Joi.number().integer().min(1).required(),
  customer_tid: Joi.string().max(128).required(),
  channel: Joi.string().optional(),
  nonce: Joi.string().optional(),
});

const tngTopUpCheckSchema = Joi.object().keys({
  srcuid: Joi.string().max(128).required(),
  srcpwd: Joi.string().max(128).required(),
  amount: Joi.number().positive().required(),
  operator: Joi.string().max(128).required(),
  country: Joi.string().max(128).required(),
  type: Joi.string().valid("PREPAID", "POSTPAID").optional(),
  customer_tid: Joi.string().max(128).required(),
  channel: Joi.string().optional(),
  nonce: Joi.string().optional(),
});

const isSpinnerAgentSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  username: Joi.string().min(1).max(128).required(),
  sessionId: Joi.string().required(),
  countryCode: Joi.string().max(10).required(),
  msisdn: Joi.string().max(20).required(),
  organizationBound: Joi.string().max(20).required(),
  registerSource: Joi.string().max(20).required(),
  useLive: Joi.boolean().required(),
  spinnerConfig: Joi.string().allow(["BD", "MY"]).required(),
});

const SpinnerAgentRegistrationSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  username: Joi.string().min(1).max(128).required(),
  countryCode: Joi.string().max(10).required(),
  fullName: Joi.string().min(1).max(128).required(),
  msisdn: Joi.string().max(20).required(),
  organizationBound: Joi.string().max(20).required(),
  password: Joi.string().min(6).max(128).required(),
  referenceKey: Joi.number().integer().min(1).required(),
  registerSource: Joi.string().max(20).required(),
  useLive: Joi.boolean().required(),
  spinnerConfig: Joi.string().allow(["BD", "MY"]).required(),
});

const SpinnerAgentLoginSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  username: Joi.string().min(1).max(128).required(),
  registerSource: Joi.string().max(20).required(),
  useLive: Joi.boolean().required(),
  spinnerConfig: Joi.string().allow(["BD", "MY"]).required(),
});

const impactCardPinSchema = Joi.object().keys({
  username: Joi.string().required(),
  productId: Joi.number().integer().min(1).required(),
  secret: Joi.string().required(),
  timestamp: Joi.date().required(),
});

const impactCardStatSchema = Joi.object().keys({
  username: Joi.string().required(),
  secret: Joi.string().required(),
  timestamp: Joi.date().required(),
});

const ledgerAppLoginApiSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  username: Joi.string().min(1).max(128).required(),
  phone: Joi.string().max(20).required(),
  role: Joi.string().valid("agent", "customer").required(),
});

const ledgerCouponExecutionSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  productId: Joi.number().integer().min(1).required(),
  productCategoryId: Joi.number().integer().min(1).optional(),
  amount: Joi.number().positive().precision(2).optional(),
  channel: Joi.string().required(),
  walletTypeId: Joi.number().integer().min(1).optional(),
  paymentMethodId: Joi.number().integer().min(1).optional(),
});

const partnerBVoiceTopUpRequestSchema = Joi.object().keys({
  srcuid: Joi.string().max(128).required(),
  srcpwd: Joi.string().max(128).required(),
  msisdn: Joi.string().max(20).required(),
  amount: Joi.number().positive().required(),
  deductibleAmount: Joi.number().positive().required(),
  operator: Joi.string().max(128).required(),
  country: Joi.string().max(128).required(),
  type: Joi.string().valid("PREPAID", "POSTPAID").optional(),
  customer_tid: Joi.string().max(64).required(),
  channel: Joi.string().max(64).optional(),
  walletTypeId: Joi.string().max(64).valid("-1").required(),
  u_trx_id: Joi.string().max(128).required(),
  nonce: Joi.string().optional(),
});

const partnerBVoiceDatapackRequestSchema = Joi.object().keys({
  srcuid: Joi.string().max(128).required(),
  srcpwd: Joi.string().max(128).required(),
  msisdn: Joi.string().max(20).required(),
  datapack_id: Joi.number().integer().min(1).required(),
  customer_tid: Joi.string().max(64).required(),
  channel: Joi.string().optional(),
  walletTypeId: Joi.string().max(64).valid("-1").required(),
  amount: Joi.number().positive().required(),
  u_trx_id: Joi.string().max(128).required(),
  nonce: Joi.string().optional(),
});

const tngCouponExecutionSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  productId: Joi.number().integer().min(1).required(),
  productCategoryId: Joi.number().integer().min(1).optional(),
  amount: Joi.number().positive().precision(2).optional(),
  channel: Joi.string().required(),
  walletTypeId: Joi.number().integer().min(1).optional(),
  paymentMethodId: Joi.number().integer().min(1).optional(),
});

const serviceCouponExecutionSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  productId: Joi.number().integer().min(1).required(),
  productCategoryId: Joi.number().integer().min(1).optional(),
  amount: Joi.number().positive().precision(2).optional(),
  channel: Joi.string().required(),
  walletTypeId: Joi.number().integer().min(1).optional(),
  paymentMethodId: Joi.number().integer().min(1).optional(),
});

const tngWalletbalanceAddSchema = Joi.object().keys({
  srcuid: Joi.string().max(128).required(),
  srcpwd: Joi.string().max(128).required(),
  amount: Joi.number().positive().precision(2).optional(),
  currencyId: Joi.number().integer().min(1).valid(1).required(),
  userId: Joi.string().required(),
  walletTypeId: Joi.string().max(64).valid("1").required(),
  nonce: Joi.string().optional(),
});

const sendOtpNewSchema = Joi.object().keys({
  countryCode: Joi.string().required(),
  mobileNo: Joi.string().max(20).required(),
  channel: Joi.string().max(20).required(),
  purpose: Joi.string().valid("forget-password").required(),
  nonce: Joi.string().optional(),
  clientApp: Joi.string().optional(),
  smsChannel: Joi.string().valid("general", "digi").optional(),
});

const otpSchemaNew = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  otp: Joi.string().required(),
  purpose: Joi.string().valid("forget-password").required(),
  nonce: Joi.string().optional(),
  mobileNo: Joi.string()
    .regex(/^[0-9]{1,20}$/)
    .optional(),
  email: Joi.string().optional(),
  countryCode: Joi.string().min(1).max(10).optional(),
});

const forgetPasswordSchemaWithOtpNew = Joi.object().keys({
  username: Joi.string().required(),
  confirmPassword: Joi.string().required(),
  password: Joi.string().required(),
  otp: Joi.string().required(),
  mobileNo: Joi.string().required(),
  purpose: Joi.string().required(),
  nonce: Joi.string().optional(),
});

const bulkOrderRequestGenericCheckSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  data: Joi.array().items(Joi.array()).min(1).required(),
  country: Joi.string().required(),
});

const bulkOrderRequestGenericFinalizeSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  sessionId: Joi.string().required(),
  batchId: Joi.string().required(),
});

const updateUserEmailSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  currentEmail: Joi.string().required(),
  newEmail: Joi.string().required(),
  password: Joi.string().required(),
  clientApp: Joi.string().optional(),
  channel: Joi.string().max(20).required(),
  purpose: Joi.string().valid("update-email").required(),
});

const addUserEmailSchema = Joi.object().keys({
  userId: Joi.number().integer().min(1).required(),
  email: Joi.string().required(),
  clientApp: Joi.string().optional(),
  channel: Joi.string().max(20).required(),
  purpose: Joi.string().valid("add-email").required(),
});

const externalSchemaMapping = require("./schemas/schemaMapping");

const schemaMapping = {
  ...externalSchemaMapping,
  "/auth/token": authSchema,
  "/api/verify-otp": otpSchema,
  "/api/verify-session": sessionSchema,
  "/api/reset-password/create": resetPasswordCreateSchema,
  "/api/reset-password/verify": resetPasswordVerifySchema,
  "/api/reset-password/update": resetPasswordUpdateSchema,
  "/api/sign-up": signUpSchema,
  "/api/sign-up/app": signUpSchemaApp,
  "/api/login": loginSchema,
  "/api/admin/login": loginSchema,
  "/api/app-token-update": appTokenUpdateSchema,
  "/api/get-user-info": userInfoSchema,
  "/api/get-specific-user-info": specificUserInfoSchema,
  "/api/get-user-list": userInfoSchema,
  "/api/get-reseller-list": userInfoSchema,
  "/api/get-cash-agent-list": userInfoSchema,
  "/api/contact-user-list": userInfoSchema,
  "/api/product-auth-info": productAuthInfoSchema,
  "/api/logout": sessionSchema,
  "/api/profile-update": profileUpdateSchema,
  "/api/create-user-profile": profileCreateSchema,
  "/api/create-reseller-profile": resellerProfileCreateSchema,
  "/api/user-profile-update": userProfileUpdateSchema,
  "/api/check-cash-agent-id": checkCashAgentIdSchema,
  "/api/set-cash-agent-id": setCashAgentIdSchema,
  "/api/change-password": changePasswordSchema,
  "/api/check-password": checkPasswordSchema,
  "/api/check-fund-transfer": checkFundTransferSchema,
  "/api/fund-transfer": fundTransferSchema,
  "/api/check-order-request": checkOrderRequestSchema,
  "/api/order-request": orderRequestSchema,
  "/api/check-bill-payment-request": billPaymentInfoSchema,
  "/api/bill-payment-request": billPaymentRequestSchema,
  "/api/check-dialer-order-request": checkDialerOrderRequestSchema,
  "/api/dialer-order-request": dialerOrderRequestSchema,
  "/api/cash-order/check": checkCashOrderRequestSchema,
  "/api/cash-order/request": cashOrderRequestSchema,
  "/api/update-order-request": updateOrderRequestSchema,
  "/api/product/create": productCreateSchema,
  "/api/product/update": productUpdateSchema,
  "/api/product/show": productShowSchema,
  "/api/product/show/all": productShowAllSchema,
  "/api/package/create": packageCreateSchema,
  "/api/package/update": packageUpdateSchema,
  "/api/package/show": packageShowSchema,
  "/api/package/purchase": packagePurchaseRequestSchema,
  "/api/package/redeem-product": packagePurchaseRedeemRequestSchema,
  "/api/package/order": packageOrderFetchSchema,
  "/api/product-rates/create": createProductRatesSchema,
  "/api/product-rates/update": updateProductRatesSchema,
  "/api/product-rates/show": showProductRatesSchema,
  "/api/role/create": roleInsertSchema,
  "/api/role/update": roleUpdateSchema,
  "/api/role/show": roleShowSchema,
  "/api/role-setting/update": roleSettingUpdateSchema,
  "/api/role-setting/show": roleShowSchema,
  "/api/lot/create": lotInsertSchema,
  "/api/lot/update": lotUpdateSchema,
  "/api/lot/delete": lotDeleteSchema,
  "/api/lot/show": lotShowSchema,
  "/api/lot/check-updatable-cards": lotDeleteSchema,
  "/api/lot/details": lotDetailsSchema,
  "/api/lot/provision": lotDeleteSchema,
  "/api/lot/provision-status": lotDeleteSchema,
  "/api/card/change-status": cardChangeStatusSchema,
  "/api/card/summary": cardSummarySchema,
  "/api/card/status": cardStatusSchema,
  "/api/card/download": cardDownloadSchema,
  "/api/card/transfer/initiate": cardOwnershipTransferInitiateSchema,
  "/api/card/transfer/act": cardOwnershipTransferActSchema,
  "/api/card/transfer/show": cardOwnershipTransferShowSchema,
  "/api/card/order": cardOrderSchema,
  "/api/card/save-promo-user-info": cardSavePromoUserInfoSchema,
  "/api/card/generate-pin": cardGeneratePinSchema,
  "/api/card/generate-voucher": cardGenerateVoucherSchema,
  "/api/route/create": routeCreateSchema,
  "/api/route/update": routeUpdateSchema,
  "/api/route/delete": routeDeleteSchema,
  "/api/route/show": routeShowSchema,
  "/api/reports/generate": reportsGenerateSchema,
  "/api/reports/download": reportsDownloadSchema,
  "/api/sales/create": salesCreationSchema,
  "/api/sales/create/portal": salesOrderCreationPortalSchema,
  "/api/sales/show": salesShowSchema,
  "/api/sales/approve": salesApproveSchema,
  "/api/fund-transfer-config/create": fundTransferConfigCreateSchema,
  "/api/fund-transfer-config/update": fundTransferConfigUpdateSchema,
  "/api/fund-transfer-config/show": fundTransferConfigShowSchema,
  "/api/download/deposit-slips": depositSlipsSchema,
  "/api/add-balance": adminBalanceSchema,
  "/api/get-discount-list": getDiscountListSchema,
  "/api/currency/create": currencyCreateSchema,
  "/api/currency/update": currencyUpdateSchema,
  "/api/currency/show": currencyShowSchema,
  "/api/configuration/create": configurationCreateSchema,
  "/api/configuration/update": configurationUpdateSchema,
  "/api/configuration/show": configurationShowSchema,
  "/api/product-category/show": productCategoryShowSchema,
  "/api/bulk-order-request/check": bulkOrderRequestCheckSchema,
  "/api/bulk-order-request/finalize": bulkOrderRequestFinalizeSchema,
  "/api/transaction-commission/update": transactionCommissionUpdateSchema,
  "/api/promo/create": promoCreateSchema,
  "/api/promo/update": promoUpdateSchema,
  "/api/promo/show": promoShowSchema,

  "/api/device/stock-info": stockInfoSchema,
  "/api/device/lot/show": deviceLotShowSchema,
  "/api/device/store": storeDeviceSchema,
  "/api/device/show": showDeviceSchema,
  "/api/device/transfer": deviceOwnershipTransferSchema,
  "/api/device/transfer/show": deviceOwnershipTransferShowSchema,
  "/api/device/transfer/details": deviceOwnershipTransferDetailsSchema,

  "/api/yankee/card/transfer": yankeeCardOwnershipTransferSchema,
  "/api/yankee/card/status": yankeeCardStatusSchema,
  "/api/yankee/card/flow": yankeeCardFlowSchema,
  "/api/yankee/card/reports": yankeeCardReportsSchema,
  "/api/yankee/card/reports/details": yankeeCardReportsDetailsSchema,

  "/api/bd-order-api": bdOrderSchema,
  "/api/bd-order-api-status": orderStatusSchema,
  "/api/top-up/check": topUpCheckSchema,
  "/api/top-up/request": topUpRequestSchema,
  "/api/digi/account/balance-add": digiAccountBalanceAddRequestSchema,
  "/api/digi/top-up/request": digiVoiceTopUpRequestSchema,
  "/api/top-up/status": orderStatusSchema,
  "/api/datapack/list": datapackListSchema,
  "/api/datapack/check": datapackCheckSchema,
  "/api/datapack/request": datapackRequestSchema,
  "/api/digi/data-pack/request": digiVoicedatapackRequestSchema,
  "/api/datapack/status": orderStatusSchema,
  "/api/platform-get-balance": platformGetBalanceSchema,
  "/api/country-b-order-api": countryBOrderSchema,
  "/api/country-b-order-api-status": countryBOrderStatusSchema,

  "/api/jompay/callback": jompayCallbackSchema,
  "/api/jompay/v2/callback": jompayCallbackSchema,
  "/api/jompay/payment-issue/approve-reject": jompayIssueApproveRejectSchema,
  "/api/jompay/payment-issue-manual": jompayIssueManualValidationSchema,

  "/api/tp/product/show": thirdPartyProductShowSchema,
  "/api/tp/reports/generate": thirdPartyReportsGenerateSchema,
  "/api/tp/operator/identify": thirdPartyOperatorIndentifySchema,

  "/platform-bot/card/pin/product-info": platformBotCardPinProductInfoSchema,
  "/platform-bot/card/pin/generate/check": platformBotCardPinGenerateCheckSchema,
  "/platform-bot/card/pin/generate": platformBotCardPinGenerateSchema,
  "/platform-bot/card/order": platformBotCardOrderSchema,
  "/platform-bot/card/inquiry": platformBotCardInquirySchema,
  "/platform-bot/card/save-promo-info": platformBotCardSavePromoInfoSchema,
  "/platform-bot/login": loginSchemaPlatformBot,
  "/platform-bot/logout": platformBotLogoutSchema,
  "/platform-bot/dialer-order-request/check":
    platformBotDialerOrderRequestCheckSchema,
  "/platform-bot/dialer-order-request": platformBotDialerOrderRequestSchema,
  "/platform-bot/top-up-request/product-info":
    platformBotTopUpRequestProductInfoSchema,
  "/platform-bot/top-up-request/check": platformBotTopUpRequestCheckSchema,
  "/platform-bot/top-up-request": platformBotTopUpRequestSchema,
  "/platform-bot/datapack/list": platformBotDatapackListSchema,
  "/platform-bot/datapack/request/check": platformBotDatapackRequestCheckSchema,
  "/platform-bot/datapack/request": platformBotDatapackRequestSchema,
  "/platform-bot/fund-transfer/check": platformBotFundTransferCheckSchema,
  "/platform-bot/fund-transfer": platformBotFundTransferSchema,

  "/api/redeem-card": redeemCardSchema,
  "/api/redeem-card/status": redeemCardStatusSchema,
  "/api/banner-images": bannerImageSchema,
  "/api/tp/balance/check": tpBalanceCheeckSchema,
  "/api/sales/team-info": salesTeamInfoSchema,
  "/api/lot/details/sales/portal": lotDetailsSchemaForSalesPortal,
  "/api/digi/datapack/check": voiceDataUpCheckSchema,
  "/api/digi/top-up/check": voiceTopUpCheckSchema,
  "/api/tp/voice/balance/check": voiceBalanceCheck,
  "/api/digi/bill-payment/request": digiBillPaymentSchema,
  "/api/tp/wallet/balance-add": digiWalletbalaneAddSchema,
  "/api/send-otp": sendOtpSchema,
  "/api/wallet/balance-add": walletBalanceAddSchema,
  "/api/wallet/balance-add/portal": walletBalanceAddSchemaPortal,
  "/api/get-user-menu-info": userMenuInfoSchema,
  "/api/user/balance-check": userMenuInfoSchema,
  "/api/pgw/transaction/initiate": pgwPaymentInitiateSchema,
  "/api/pgw/check-online-sale": pgwCheckOnlineSaleSchema,
  "/api/user/get-mobile-number": getMobileNumberInfo,
  "/api/user/forget-password": forgetPasswordSchemaWithOtp,
  "/api/get/promotions": getPromotionsSchema,
  "/api/promotions/execute": promotionsExecutionSchema,
  "/api/zulu/generate-coupon": zuluCouponExecutionSchema,
  "/api/referral/add/balance": referralAddBalanceSchema,
  "/api/referral/users/role": referralUsersRoleSchema,
  "/api/referral/create-link": referralCreateLinkSchema,
  "/api/referral/add-user": referralAddUser,
  "/api/tp/add/balance": thirdPartyAddBalaneSchema,

  "/api/tp/product/list": tpProductListSchema,
  "/api/tp/bill-payment-info": tpBillPaymentInfoSchema,
  "/api/tp/bill-payment-request": tpBillPaymentRequestSchema,
  "/api/tp/transaction/status": orderStatusSchema,

  "/api/zulu/subscription": zuluSubscriptionSchema,
  "/api/digi/zulu/request": voiceZuluRequest,

  "/api/promotions/subscription": promotionsSubscriptionSchema,

  "/api/banner/create": bannerCreateSchema,
  "/api/banner/update": bannerUpdateSchema,
  "/api/banner/list": bannerListSchema,

  "/api/user/nearby-agents": nearbyAgentsRequestSchema,

  "/api/send/notification": notificationSchema,

  "/api/change-phone-number": changePhoneNumberSchema,

  "/api/user/device/registration": deviceRegistrationSchema,
  "/api/user/device/delete": deleteDeviceSchema,
  "/api/user/device/list": fetchDeviceListSchema,
  "/api/notification-inapp/send": inAppNotificationSchema,
  "/api/get-inapp-notifications": getInAppNotifications,

  "/api/change-user-email": changeEmailSchema,

  "/api/digi/number/check": checkValidPartnerNumber,

  "/api/channelB/data-pack/request": digiVoicedatapackRequestSchema,
  "/api/channelB/top-up/request": digiVoiceTopUpRequestSchema,
  "/api/channelB/datapack/check": tngDataUpCheckSchema,
  "/api/channelB/top-up/check": tngTopUpCheckSchema,
  "/api/spinner/is-agent": isSpinnerAgentSchema,
  "/api/spinner/agent-registration": SpinnerAgentRegistrationSchema,
  "/api/spinner/auto-login": SpinnerAgentLoginSchema,
  "/api/impact/get-pin": impactCardPinSchema,
  "/api/impact/product/card-statistic": impactCardStatSchema,
  "/api/ledger/app-login": ledgerAppLoginApiSchema,
  "/api/ledger/generate-coupon": ledgerCouponExecutionSchema,
  "/api/mobile/top-up/request": partnerBVoiceTopUpRequestSchema,
  "/api/mobile/datapack/request": partnerBVoiceDatapackRequestSchema,
  "/api/channelB/generate-coupon": tngCouponExecutionSchema,
  "/api/quizzer/generate-coupon": serviceCouponExecutionSchema,
  "/api/channelB/wallet/balance-add": tngWalletbalanceAddSchema,
  "/api/send-otp-new": sendOtpNewSchema,
  "/api/verify-otp-new": otpSchemaNew,
  "/api/user/forget-password-new": forgetPasswordSchemaWithOtpNew,
  "/api/bulk-order-request-generic/check":
    bulkOrderRequestGenericCheckSchema,
  "/api/bulk-order-request-generic/finalize":
    bulkOrderRequestGenericFinalizeSchema,
  "/api/add-user-email": addUserEmailSchema,
  "/api/update-user-email": updateUserEmailSchema,
};

module.exports = function (req, res, next) {
  let result = {};

  let schema = schemaMapping[req.originalUrl];

  if (!schema) {
    next();
    return;
  }
  const validationResult = Joi.validate(req.body, schema, {
    convert: true,
  });
  if (validationResult.error !== null && req.originalUrl.startsWith("/bot")) {
    res.json({
      messages: [
        {
          text: `FAILED: ${validationResult.error.message}`,
        },
      ],
    });
    return;
  }

  if (
    validationResult.error !== null &&
    req.originalUrl.startsWith("/platform-bot")
  ) {
    const firstError = validationResult.error.details.pop();
    let error = getResErr(firstError);
    res.json({
      code: error.code,
      message: resDet.getDetails(Number(error.code) + resDet.offset.platform_bot),
    });
    return;
  }

  if (
    validationResult.error !== null &&
    req.originalUrl.startsWith("/api/redeem-card")
  ) {
    return res.json({
      status: resultCodes.INVALID_PARAMS_ERR.code,
      error: "Bad request",
    });
  }

  if (
    validationResult.error !== null &&
    req.originalUrl.startsWith("/api/jompay/callback")
  ) {
    return res.json({
      body: {
        result: "N",
        errorcode: resultCodes.INVALID_PARAMS_ERR.code,
        errormessage: "Bad request",
        resend: "N",
      },
    });
  }

  if (
    validationResult.error !== null &&
    req.originalUrl.startsWith("/api/jompay/v2/callback")
  ) {
    console.log("/api/jompay/v2/callback called!", validationResult.error);
    return res.json({
      body: {
        result: "N",
        errorcode: resultCodes.INVALID_PARAMS_ERR.code,
        errormessage: "Bad request",
        resend: "N",
      },
    });
  }

  if (
    validationResult.error !== null &&
    [
      "/api/bd-order-api",
      "/api/bd-order-api-status",
      "/api/platform-get-balance",
      "/api/country-b-order-api",
      "/api/country-b-order-api-status",
      "/api/top-up/check",
      "/api/top-up/request",
      "/api/top-up/status",
      "/api/datapack/list",
      "/api/datapack/check",
      "/api/datapack/request",
      "/api/datapack/status",
      "/api/referral/add/balance",
      "/api/tp/product/list",
      "/api/tp/bill-payment/info",
      "/api/tp/bill-payment/request",
      "/api/tp/transaction/status",
    ].some((thirdPartyUrl) => req.originalUrl.startsWith(thirdPartyUrl))
  ) {
    const firstError = validationResult.error.details.pop();
    res.json({
      status: 400,
      error: firstError.message,
    });
    return;
  }

  if (validationResult.error !== null) {
    const firstError = validationResult.error.details.pop();
    result.error = getResErr(firstError);
    result.errorMessage = firstError.message;
  }

  if (Object.keys(result).length !== 0) {
    res.json(resultCodes.responseGenerator(result.error, result.errorMessage));
    return;
  }

  if (!req.body.nonce) {
    next();
    return;
  }

  db.redis.get(queries.keyForNonce(req.body.nonce), function (err, reply) {
    if (err) {
      res.json(
        resultCodes.responseGenerator(resultCodes.INTERNAL_SERVER_ERROR, err)
      );
      return;
    }

    if (reply) {
      res.json(
        resultCodes.responseGenerator(
          resultCodes.INVALID_PARAMS_ERR,
          "Duplicate payload"
        )
      );
      return;
    }

    db.redis.set(
      queries.keyForNonce(req.body.nonce),
      Math.floor(Date.now() / 1000),
      "EX",
      300,
      function (err, reply) {
        if (err) {
          res.json(
            resultCodes.responseGenerator(
              resultCodes.INTERNAL_SERVER_ERROR,
              err
            )
          );
          return;
        }

        next();
      }
    );
  });
};
