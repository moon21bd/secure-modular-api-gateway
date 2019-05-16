"use strict";

const config = require("../../config");

module.exports = {
  productCategoryInfo: `
        SELECT category_id AS categoryId, category_name AS categoryName
        FROM platform_product_category
        WHERE (category_id = ? OR ? = 0)
            AND category_status = 1
            AND category_is_viewable = 1 
    `,
  productAuthInfo: `
        SELECT pc.category_name AS categoryName,
               us.user_settings_password_authentication AS passwordAuthentication, 
               us.user_settings_email_authentication AS emailAuthentication
        FROM platform_user_settings AS us
        JOIN platform_product_category AS pc
        ON us.user_settings_product_category_id = pc.category_id
        WHERE us.user_settings_user_id = ? 
            AND us.user_settings_product_category_id = ?
            AND pc.category_status = 1
    `,
  createProductInfo: `
        INSERT INTO platform_product_info(
            product_name, product_description, product_category_id, product_execution_id, product_value,
            product_sales_value, product_comission_applicable, product_variable_amount, product_minimum_value,
            product_maximum_value, product_probable_amounts, product_discount_applicable, product_currency_id,
            product_image, product_reference_1, product_reference_2, product_reference_3, product_reference_4,
            product_reference_5, product_reference_6, product_reference_7, created_by
        )
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  updateProductInfo: `
        UPDATE platform_product_info 
        SET product_name = IF (? IS NULL, product_name, ?),
            product_description = IF (? IS NULL, product_description, ?),
            product_status = IF (? IS NULL, product_status, ?),
            product_category_id = IF (? IS NULL, product_category_id, ?),
            product_execution_id = IF (? IS NULL, product_execution_id, ?),
            product_value = IF (? IS NULL, product_value, ?),
            product_sales_value = IF (? IS NULL, product_sales_value, ?),
            product_comission_applicable = IF (? IS NULL, product_comission_applicable, ?),
            product_variable_amount = IF (? IS NULL, product_variable_amount, ?),
            product_minimum_value = IF (? IS NULL, product_minimum_value, ?),
            product_maximum_value = IF (? IS NULL, product_maximum_value, ?),
            product_probable_amounts = IF (? IS NULL, product_probable_amounts, ?),
            product_discount_applicable = IF (? IS NULL, product_discount_applicable, ?),
            product_currency_id = IF (? IS NULL, product_currency_id, ?),
            product_image = IF (? IS NULL, product_image, ?), 
            product_reference_1 = IF (? IS NULL, product_reference_1, ?),
            product_reference_2 = IF (? IS NULL, product_reference_2, ?),
            product_reference_3 = IF (? IS NULL, product_reference_3, ?),
            product_reference_4 = IF (? IS NULL, product_reference_4, ?),
            product_reference_5 = IF (? IS NULL, product_reference_5, ?),
            product_reference_6 = IF (? IS NULL, product_reference_6, ?),
            product_reference_7 = IF (? IS NULL, product_reference_7, ?),
            updated_by = ?
        WHERE product_id = ?
    `,
  productInfo: function (whereCondition, channel = "") {
    console.log("whereCondition", whereCondition, channel);
    // return false
    return `
            SELECT a.*,platform_get_product_charges_by_pid(a.productId, a.productSalesValue, '${channel}') AS productSalesValueWithCommissionAndCharge
            FROM (
            SELECT pi.product_id AS productId, pi.product_name AS productName, pi.product_description AS productDescription, pi.product_execution_id AS productExecutionConfigId, 
                   pi.product_value AS productValue, pi.product_sales_value AS productSalesValue, pi.product_variable_amount AS isVariableAmount, 
                   pi.product_minimum_value AS productMinimumValue, pi.product_maximum_value AS productMaximumValue, pi.product_probable_amounts AS probableAmounts, 
                   pi.product_comission_applicable AS isComissionApplicable, pi.product_discount_applicable AS isDiscountApplicable,
                   pi.product_prefix AS productPrefix, pi.product_image AS productImage, pc.category_id AS productCategoryId, 
                   pc.category_name AS productCategoryName, pi.product_reference_1 AS operator, pi.product_reference_1 AS reference1,
                   pi.product_reference_2 AS reference2, pi.product_reference_3 AS reference3, pi.product_reference_4 AS reference4,
                   pi.product_reference_5 AS reference5, pi.product_reference_6 AS reference6, pi.product_reference_7 AS reference7,
                   c.currency_country_id AS currencyId, c.currency_name AS currencyName, c.currency_conversion_rate AS currencyConversionRate, 
                   c.currency_country_name AS countryName, c.currency_country_code AS countryCode, c.currency_iso_alpha_2_code AS isoAlpha2Code
            FROM platform_product_info AS pi 
            JOIN platform_product_category AS pc ON pi.product_category_id = pc.category_id
            JOIN platform_currency AS c ON pi.product_currency_id = c.currency_country_id
            ${whereCondition}
            ORDER BY pi.product_order ASC, pi.product_id ASC ) a
        `;
  },
  productInfoInUserCurrency: function (whereCondition, userId) {
    return `
            SELECT pi.product_id AS productId, pi.product_name AS productName, pi.product_description AS productDescription, pi.product_execution_id AS productExecutionConfigId, 
                   pi.product_value AS productValue,pi.product_sales_value AS productSalesValue, pi.product_variable_amount AS isVariableAmount, 
                   pi.product_minimum_value AS productMinimumValue, pi.product_maximum_value AS productMaximumValue, pi.product_probable_amounts AS probableAmounts, 
                   pi.product_comission_applicable AS isComissionApplicable, pi.product_discount_applicable AS isDiscountApplicable,
                   pi.product_prefix AS productPrefix, pi.product_image AS productImage, pc.category_id AS productCategoryId, 
                   pc.category_name AS productCategoryName, pi.product_reference_1 AS operator, pi.product_reference_1 AS reference1,
                   pi.product_reference_2 AS reference2, pi.product_reference_3 AS reference3, pi.product_reference_4 AS reference4,
                   pi.product_reference_5 AS reference5, pi.product_reference_6 AS reference6, pi.product_reference_7 AS reference7, pi.product_reference_8 AS reference8,
                   c.currency_country_id AS currencyId, c.currency_name AS currencyName, c.currency_conversion_rate AS currencyConversionRate, 
                   c.currency_country_name AS countryName, c.currency_country_code AS countryCode, c.currency_iso_alpha_2_code AS isoAlpha2Code
            FROM platform_product_info AS pi 
            JOIN platform_product_category AS pc ON pi.product_category_id = pc.category_id
            JOIN platform_currency AS c ON pi.product_currency_id = c.currency_country_id
            ${whereCondition}
            ORDER BY pi.product_order ASC, pi.product_id ASC
        `;
  },

  productInfoWithCommission: function (whereCondition, roleId, channel = "") {
    // console.log('whereCondition', whereCondition, channel)
    return `
            SELECT a.*,platform_get_product_charges_by_pid(a.productId, a.productSalesValueAfterCommission, '${channel}') AS productSalesValueWithCommissionAndCharge
            FROM (
            SELECT pi.product_id AS productId, pi.product_name AS productName, pi.product_description AS productDescription, pi.product_execution_id AS productExecutionConfigId, 
                   pi.product_value AS productValue,pi.product_sales_value AS productSalesValue, pi.product_variable_amount AS isVariableAmount, 
                   pi.product_minimum_value AS productMinimumValue, pi.product_maximum_value AS productMaximumValue, pi.product_probable_amounts AS probableAmounts, 
                   pi.product_comission_applicable AS isComissionApplicable, pi.product_discount_applicable AS isDiscountApplicable,
                   pi.product_prefix AS productPrefix, pi.product_image AS productImage, pc.category_id AS productCategoryId, 
                   pc.category_name AS productCategoryName, pi.product_reference_1 AS operator, pi.product_reference_1 AS reference1,
                   pi.product_reference_2 AS reference2, pi.product_reference_3 AS reference3, pi.product_reference_4 AS reference4,
                   pi.product_reference_5 AS reference5, pi.product_reference_6 AS reference6, pi.product_reference_7 AS reference7,
                   c.currency_country_id AS currencyId, c.currency_name AS currencyName, c.currency_conversion_rate AS currencyConversionRate, 
                   c.currency_country_name AS countryName, c.currency_country_code AS countryCode,pr.rate_amount AS commissionRateAmount,
                   pr.rate_applicable_type AS commissionRateApplicablity,
                   platform_round_amount(IF (pr.rate_amount IS NULL, 
                       pi.product_sales_value, 
                       pi.product_sales_value - (
                           IF (pr.rate_applicable_type = 1, (pi.product_sales_value * pr.rate_amount) / 100, IF (pr.rate_applicable_type = 0, pr.rate_amount, 0))
                       )
                   ), -1) AS productSalesValueAfterCommission
            FROM platform_product_info AS pi 
            JOIN platform_product_category AS pc ON pi.product_category_id = pc.category_id
            JOIN platform_currency AS c ON pi.product_currency_id = c.currency_country_id
            LEFT JOIN platform_product_rates AS pr 
                ON pi.product_id = pr.rate_productid AND pi.product_comission_applicable = 1
                AND pr.rate_roleid = ${roleId}
                AND pr.rate_type = 'comission' 
                AND pr.rate_status = 1
            ${whereCondition}
            ORDER BY pi.product_order ASC, pi.product_id ASC ) a
        `;
  },
  productInfoWithCommissionInUserCurrency: function (
    whereCondition,
    roleId,
    userId
  ) {
    return `
            SELECT pi.product_id AS productId, pi.product_name AS productName, pi.product_description AS productDescription, pi.product_execution_id AS productExecutionConfigId, 
                   pi.product_value AS productValue,pi.product_sales_value AS productSalesValue, pi.product_variable_amount AS isVariableAmount, 
                   pi.product_minimum_value AS productMinimumValue, pi.product_maximum_value AS productMaximumValue, pi.product_probable_amounts AS probableAmounts, 
                   pi.product_comission_applicable AS isComissionApplicable, pi.product_discount_applicable AS isDiscountApplicable,
                   pi.product_prefix AS productPrefix, pi.product_image AS productImage, pc.category_id AS productCategoryId, 
                   pc.category_name AS productCategoryName, pi.product_reference_1 AS operator, pi.product_reference_1 AS reference1,
                   pi.product_reference_2 AS reference2, pi.product_reference_3 AS reference3, pi.product_reference_4 AS reference4,
                   pi.product_reference_5 AS reference5, pi.product_reference_6 AS reference6, pi.product_reference_7 AS reference7, pi.product_reference_8 AS reference8,
                   c.currency_country_id AS currencyId, c.currency_name AS currencyName, c.currency_conversion_rate AS currencyConversionRate, 
                   c.currency_country_name AS countryName, c.currency_country_code AS countryCode,pr.rate_amount AS commissionRateAmount,
                   pr.rate_applicable_type AS commissionRateApplicablity,
                   CAST(platform_currency_convertion(${userId}, platform_round_amount(IF (pr.rate_amount IS NULL, 
                       pi.product_sales_value, 
                       pi.product_sales_value - (
                           IF (pr.rate_applicable_type = 1, (pi.product_sales_value * pr.rate_amount) / 100, IF (pr.rate_applicable_type = 0, pr.rate_amount, 0))
                       )
                   ), -1) ,'-1')AS DECIMAL(10,2)) AS productSalesValueAfterCommission
            FROM platform_product_info AS pi 
            JOIN platform_product_category AS pc ON pi.product_category_id = pc.category_id
            JOIN platform_currency AS c ON pi.product_currency_id = c.currency_country_id
            LEFT JOIN platform_product_rates AS pr 
                ON pi.product_id = pr.rate_productid AND pi.product_comission_applicable = 1
                AND pr.rate_roleid = ${roleId}
                AND pr.rate_type = 'comission' 
                AND pr.rate_status = 1
            ${whereCondition}
            ORDER BY pi.product_order ASC, pi.product_id ASC
        `;
  },

  productInfoUsingId: `
        SELECT pi.product_id AS productId, pi.product_name AS productName, pi.product_description AS productDescription, pi.product_execution_id AS executionConfigId, 
               pi.product_value AS productValue, pi.product_sales_value AS salesValue, pi.product_variable_amount AS isVariableAmount,  
               pi.product_minimum_value AS productMinimumValue, pi.product_maximum_value AS productMaximumValue, pi.product_probable_amounts AS probableAmounts, 
               pi.product_comission_applicable AS isComissionApplicable, pi.product_discount_applicable AS isDiscountApplicable,
               pi.product_prefix AS productPrefix, pi.product_image AS productImage, pi.product_category_id AS productCategoryId, 
               pi.product_reference_1 AS ref1, pi.product_reference_2 AS ref2, pi.product_reference_3 AS ref3,
               pi.product_reference_4 AS ref4, pi.product_reference_5 AS ref5, pi.product_reference_6 AS ref6, pi.product_reference_7 AS ref7,
               c.currency_country_id AS currencyId, c.currency_name AS currencyName
        FROM platform_product_info AS pi JOIN platform_currency AS c ON pi.product_currency_id = c.currency_country_id
        WHERE pi.product_id = ? AND pi.product_status = 1 AND c.currency_status = 1
    `,
  productInfoUsingOperator: `
        SELECT pi.product_id AS productId, pi.product_name AS productName, pi.product_description AS productDescription, pi.product_execution_id AS executionConfigId, 
               pi.product_value AS productValue, pi.product_sales_value AS salesValue, pi.product_variable_amount AS isVariableAmount,  
               pi.product_minimum_value AS productMinimumValue, pi.product_maximum_value AS productMaximumValue, pi.product_probable_amounts AS probableAmounts, 
               pi.product_comission_applicable AS isComissionApplicable, pi.product_discount_applicable AS isDiscountApplicable,
               pi.product_prefix AS productPrefix, pi.product_image AS productImage, pi.product_category_id AS productCategoryId, 
               pi.product_reference_1 AS ref1, pi.product_reference_2 AS ref2, pi.product_reference_3 AS ref3,
               pi.product_reference_4 AS ref4, pi.product_reference_5 AS ref5, pi.product_reference_6 AS ref6, pi.product_reference_7 AS ref7,
               c.currency_country_id AS currencyId, c.currency_name AS currencyName
        FROM platform_product_info AS pi JOIN platform_currency AS c ON pi.product_currency_id = c.currency_country_id
        WHERE pi.product_id = ? AND (pi.product_reference_1 IS NULL OR pi.product_reference_1 = 'NA' OR pi.product_reference_1 = ?) AND pi.product_status = 1 AND c.currency_status = 1
    `,
  productInformationForCardCheck: `
        SELECT pi.product_name AS productName, pi.product_description AS productDescription
        FROM platform_product_info AS pi WHERE pi.product_id = ?
    `,
  productInfoUsingRefName: `
        SELECT pi.product_id AS productId, pi.product_name AS productName, pi.product_description AS productDescription, pi.product_execution_id AS executionConfigId, 
               pi.product_value AS productValue, pi.product_sales_value AS salesValue, pi.product_variable_amount AS isVariableAmount,  
               pi.product_minimum_value AS productMinimumValue, pi.product_maximum_value AS productMaximumValue, pi.product_probable_amounts AS probableAmounts, 
               pi.product_comission_applicable AS isComissionApplicable, pi.product_discount_applicable AS isDiscountApplicable,
               pi.product_prefix AS productPrefix, pi.product_image AS productImage, pi.product_category_id AS productCategoryId, 
               pi.product_reference_1 AS ref1, pi.product_reference_2 AS ref2, pi.product_reference_3 AS ref3,
               pi.product_reference_4 AS ref4, pi.product_reference_5 AS ref5, pi.product_reference_6 AS ref6, pi.product_reference_7 AS ref7,
               c.currency_country_name AS countryName, c.currency_country_code AS countryCode, c.currency_iso_alpha_2_code AS isoAlpha2Code
        FROM platform_product_info AS pi
        JOIN platform_product_category AS pc ON pi.product_category_id = pc.category_id
        JOIN platform_currency AS c ON pi.product_currency_id = c.currency_country_id
        WHERE (pi.product_name = ? OR pi.product_reference_5 = ?)
        AND pc.category_id = ?
        AND (? IS NULL OR pi.product_reference_1 = ?)
        ORDER BY pi.product_id DESC
        LIMIT 1
    `,
  checkForMultipleProductIds: `
        SELECT COUNT(*) AS counter FROM platform_product_info WHERE product_id IN (?) AND product_status = 1
    `,
  checkForMultiplePackageIds: `
        SELECT COUNT(*) AS counter FROM platform_package WHERE package_id IN (?) AND package_status = 1
    `,
  checkProductId:
    "SELECT 1 AS isExists FROM platform_product_info WHERE product_id = ? AND product_status = 1",
  specificPackage: `
        SELECT p.package_id AS packageId, p.package_name AS packageName, p.package_sales_value AS salesValue,
               p.package_status AS status, GROUP_CONCAT(CONCAT(pi.product_id, '|', pi.product_name) SEPARATOR '$') AS productList
        FROM platform_package AS p 
        LEFT JOIN platform_package_products AS pp
            INNER JOIN platform_product_info AS pi ON pp.product_id = pi.product_id
        ON p.package_id = pp.package_id
        WHERE p.package_id = ?
    `,
  orderInfoForPackage: `
        SELECT p.package_id AS packageId, p.package_sales_value AS salesValue, pi.product_id AS productId,
               pi.product_category_id AS productCategoryId, pi.product_execution_id AS executionConfigId, 
               pi.product_value AS productValue, pi.product_currency_id AS productCurrencyId, pi.product_reference_1 AS ref1, 
               pi.product_reference_2 AS ref2, pi.product_reference_3 AS ref3, pi.product_reference_4 AS ref4, 
               pi.product_reference_5 AS ref5, pi.product_reference_6 AS ref6, pi.product_reference_7 AS ref7, 
               pp.package_products_execute_after AS executeAfter
        FROM platform_package AS p 
        LEFT JOIN platform_package_products AS pp
            INNER JOIN platform_product_info AS pi ON pp.product_id = pi.product_id
        ON p.package_id = pp.package_id
        WHERE p.package_id = ? AND p.package_status = 1 AND pp.package_products_status = 1
            AND pi.product_reference_1 = ?
        ORDER BY pp.package_products_order ASC 
    `,
  orderInfoForPackageUsingOperator: `
        SELECT p.package_id AS packageId, p.package_sales_value AS salesValue, pi.product_id AS productId,
               pi.product_category_id AS productCategoryId, pi.product_execution_id AS executionConfigId, 
               pi.product_value AS productValue, pi.product_currency_id AS productCurrencyId, pi.product_reference_1 AS ref1, 
               pi.product_reference_2 AS ref2, pi.product_reference_3 AS ref3, pi.product_reference_4 AS ref4, 
               pi.product_reference_5 AS ref5, pi.product_reference_6 AS ref6, pi.product_reference_7 AS ref7, 
               pp.package_products_execute_after AS executeAfter
        FROM platform_lot_products as lp
        JOIN platform_package AS p ON lp.package_id = p.package_id
            INNER JOIN platform_package_products AS pp ON p.package_id = pp.package_id
            INNER JOIN platform_product_info AS \`pi\` ON pp.product_id = \`pi\`.product_id
        WHERE lp.lot_id = ? 
            AND lp.lot_products_status = 1 AND p.package_status = 1 
            AND pp.package_products_status = 1 AND pi.product_status = 1
            AND pi.product_reference_1 = ?
        ORDER BY pp.package_products_order ASC
    `,
  orderInfoForProductUsingOperator: `
        SELECT pi.product_id AS productId, pi.product_name AS productName, pi.product_description AS productDescription, pi.product_execution_id AS executionConfigId, 
               pi.product_value AS productValue, pi.product_sales_value AS salesValue, pi.product_variable_amount AS isVariableAmount,  
               pi.product_minimum_value AS productMinimumValue, pi.product_maximum_value AS productMaximumValue, pi.product_probable_amounts AS probableAmounts, 
               pi.product_comission_applicable AS isComissionApplicable, pi.product_discount_applicable AS isDiscountApplicable,
               pi.product_prefix AS productPrefix, pi.product_image AS productImage, pi.product_category_id AS productCategoryId, 
               pi.product_reference_1 AS ref1, pi.product_reference_2 AS ref2, pi.product_reference_3 AS ref3,
               pi.product_reference_4 AS ref4, pi.product_reference_5 AS ref5, pi.product_reference_6 AS ref6, pi.product_reference_7 AS ref7,
               c.currency_country_id AS currencyId, c.currency_name AS currencyName
        FROM platform_lot_products as lp
            INNER JOIN platform_product_info AS \`pi\` ON lp.product_id = \`pi\`.product_id
            INNER JOIN platform_currency AS c ON pi.product_currency_id = c.currency_country_id
        WHERE lp.lot_id = ? 
        AND lp.lot_products_status = 1 
        AND pi.product_reference_1 = ? AND pi.product_status = 1 AND c.currency_status = 1
        LIMIT 1
    `,
  packageInfoWithDetails: function (whereCondition) {
    return `SELECT p.package_id AS packageId, p.package_name AS packageName, p.package_sales_value AS salesValue, 
        p.package_groupname AS groupName, p.package_is_viewable AS isViewable, p.package_status AS status,
        pi.product_id AS productId, pi.product_name AS productName, pp.package_products_status AS active, 
        pp.package_products_order AS productOrder, pp.package_products_execute_after AS executeAfter,
        pi.product_description AS productDescription, pi.product_execution_id AS productExecutionConfigId, 
        pi.product_value AS productValue, pi.product_sales_value AS productSalesValue, pi.product_variable_amount AS isVariableAmount, 
        pi.product_minimum_value AS productMinimumValue, pi.product_maximum_value AS productMaximumValue, pi.product_probable_amounts AS probableAmounts, 
        pi.product_comission_applicable AS isComissionApplicable, pi.product_discount_applicable AS isDiscountApplicable,
        pi.product_prefix AS productPrefix, pi.product_image AS productImage, pi.product_reference_1 AS operator, pi.product_reference_1 AS reference1,
        pi.product_reference_2 AS reference2, pi.product_reference_3 AS reference3, pi.product_reference_4 AS reference4,
        pi.product_reference_5 AS reference5, pi.product_reference_6 AS reference6, pi.product_reference_7 AS reference7,
        c.currency_country_id AS currencyId, c.currency_name AS currencyName, c.currency_conversion_rate AS currencyConversionRate, 
        c.currency_country_name AS countryName, c.currency_country_code AS countryCode, c.currency_iso_alpha_2_code AS isoAlpha2Code
        FROM platform_package AS p
        LEFT JOIN platform_package_products AS pp
        INNER JOIN platform_product_info AS pi ON pp.product_id = pi.product_id
        INNER JOIN platform_currency AS c ON pi.product_currency_id = c.currency_country_id
        ON p.package_id = pp.package_id
        ${whereCondition}`;
  },
  allPackages: `
        SELECT p.package_id AS packageId, p.package_name AS packageName, p.package_sales_value AS salesValue, p.package_status AS status, 
               GROUP_CONCAT(CONCAT(pi.product_id, '|', pi.product_name, '|', pp.package_products_status, '|', pp.package_products_order, '|', pp.package_products_execute_after) SEPARATOR '$') AS productList
        FROM platform_package AS p 
        LEFT JOIN platform_package_products AS pp
            INNER JOIN platform_product_info AS pi ON pp.product_id = pi.product_id
        ON p.package_id = pp.package_id
        GROUP BY p.package_id
    `,
  productInfoForPackage: `
        SELECT pi.product_name AS productName, pi.product_description AS productDescription
        FROM platform_package_products AS pp JOIN platform_product_info AS pi ON pp.product_id = pi.product_id
        WHERE pp.package_id = ?
    `,
  fetchMultipleProductInfo: `
        SELECT product_id AS productId, product_name AS productName, product_variable_amount AS variableAmount, product_minimum_value AS minimumValue,
               product_maximum_value AS maximumValue, product_probable_amounts AS probableAmounts, product_currency_id AS currencyId,
               product_reference_1 AS ref1, product_reference_2 AS ref2
        FROM platform_product_info
        WHERE product_name IN (?) AND product_status = 1
    `,
  createProductRates: `
        INSERT INTO platform_product_rates(rate_type, rate_roleid, rate_productid, rate_userid, rate_priority, rate_applicable_type, rate_amount, created_by)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?)
    `,
  updateProductRates: `
        UPDATE platform_product_rates
        SET rate_type = IF (? IS NULL, rate_type, ?),
            rate_status = IF (? IS NULL, rate_status, ?),
            rate_roleid = IF (? IS NULL, rate_roleid, IF(? = 0, NULL, ?)),
            rate_productid = IF (? IS NULL, rate_productid, ?),
            rate_userid = IF (? IS NULL, rate_userid, IF(? = 0, NULL, ?)),
            rate_priority = IF (? IS NULL, rate_priority, ?),
            rate_applicable_type = IF (? IS NULL, rate_applicable_type, ?),
            rate_amount = IF (? IS NULL, rate_amount, ?),
            updated_by = ?
        WHERE rate_id = ?
    `,
  createPackage: `
        INSERT INTO platform_package(package_name, package_description, package_groupname, package_is_viewable, package_sales_value, created_by)
        VALUES(?, ?, ?, ?, ?, ?)
    `,
  updatePackage: `
        UPDATE platform_package
        SET package_name = IF(? IS NULL, package_name, ?),
            package_description = IF(? IS NULL, package_description, ?), 
            package_groupname = IF(? IS NULL, package_groupname, ?),
            package_is_viewable = IF(? IS NULL, package_is_viewable, ?),
            package_status = IF(? IS NULL, package_status, ?),
            package_sales_value = IF(? IS NULL, package_sales_value, ?),
            updated_by = ?
        WHERE package_id = ?
    `,
  insertPackageProductsRelation: `
        INSERT INTO platform_package_products(package_id, product_id, package_products_order, package_products_execute_after, created_by)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY
        UPDATE package_products_status = 1,
               package_products_order = ?,
               package_products_execute_after = ?,
               updated_by = ?
    `,
  deletePackageProductsRelation: `
        UPDATE platform_package_products SET package_products_status = 0, updated_by = ? WHERE package_id = ? AND product_id = ?
    `,
  multipleProductsInfoUsingOperator: function (dynamicINs) {
    return `
            SELECT product_id AS productId, product_name AS productName, product_category_id AS productCategoryId, product_variable_amount AS variableAmount, 
                   product_minimum_value AS minimumValue, product_maximum_value AS maximumValue, product_probable_amounts AS probableAmounts, product_currency_id AS currencyId,
                   product_reference_1 AS ref1, product_reference_2 AS ref2, product_reference_3 AS ref3
            FROM platform_product_info
            WHERE 
            (product_reference_1, product_reference_2) IN (${dynamicINs})
            AND product_status = 1
            AND product_category_id = ${config.categoryIdMapping.TOP_UP}
        `;
  },
  singleProductInfoUsingOperator: `
        SELECT product_id AS productId, product_name AS productName, product_category_id AS productCategoryId, product_variable_amount AS variableAmount, 
               product_minimum_value AS minimumValue, product_maximum_value AS maximumValue, product_probable_amounts AS probableAmounts, product_currency_id AS currencyId,
               product_reference_1 AS ref1, product_reference_2 AS ref2, product_reference_3 AS ref3
        FROM platform_product_info
        WHERE 
            product_reference_1 = ?
        AND product_reference_2 = ?
        AND product_category_id = ${config.categoryIdMapping.TOP_UP}
        AND product_status = 1
        ORDER BY product_id DESC
        LIMIT 1
    `,
  productInfoForTopUp: `
        SELECT product_id AS productId, product_name AS productName, product_category_id AS productCategoryId, product_execution_id AS executionConfigId, 
               product_value AS amount, product_sales_value AS salesAmount, product_variable_amount AS variableAmount, 
               product_minimum_value AS minimumValue, product_maximum_value AS maximumValue, product_probable_amounts AS probableAmounts, product_currency_id AS currencyId,
               product_reference_1 AS ref1, product_reference_2 AS ref2, product_reference_3 AS ref3, product_reference_4 AS ref4, product_reference_5 AS ref5, 
               product_reference_6 AS ref6, product_reference_7 AS ref7, currency_country_name AS countryName, currency_iso_alpha_2_code AS isoAlpha2Code, currency_conversion_rate AS currencyConversionRate 
        FROM platform_product_info JOIN platform_currency ON product_currency_id = currency_country_id
        WHERE 
            product_reference_1 = ?
        AND product_reference_2 = ?
        AND product_category_id = ${config.categoryIdMapping.TOP_UP}
        AND product_status = 1
        AND currency_country_name = ?
        ORDER BY product_id DESC
        LIMIT 1
    `,
  productInfoForTopUpMobile: `
        SELECT product_id AS productId, product_name AS productName, product_category_id AS productCategoryId, product_execution_id AS executionConfigId, 
            product_value AS amount, product_sales_value AS salesAmount, product_variable_amount AS variableAmount, 
            product_minimum_value AS minimumValue, product_maximum_value AS maximumValue, product_probable_amounts AS probableAmounts, product_currency_id AS currencyId,
            product_reference_1 AS ref1, product_reference_2 AS ref2, product_reference_3 AS ref3, product_reference_4 AS ref4, product_reference_5 AS ref5, 
            product_reference_6 AS ref6, product_reference_7 AS ref7, currency_country_name AS countryName, currency_iso_alpha_2_code AS isoAlpha2Code
        FROM platform_product_info JOIN platform_currency ON product_currency_id = currency_country_id
        WHERE 
            product_reference_1 = ?
        AND product_reference_2 = ?
        AND product_category_id = ${config.categoryIdMapping.TOP_UP}
        AND product_status = 1
        AND currency_country_name = ?
        ORDER BY product_id DESC
        LIMIT 1
    `,
  productInfoForDataPack: `
        SELECT product_id AS productId, product_name AS productName, product_category_id AS productCategoryId, product_execution_id AS executionConfigId, 
               product_value AS amount, product_sales_value AS salesAmount, product_variable_amount AS variableAmount,  
               product_minimum_value AS minimumValue, product_maximum_value AS maximumValue, product_probable_amounts AS probableAmounts, product_currency_id AS currencyId,
               product_reference_1 AS ref1, product_reference_2 AS ref2, product_reference_3 AS ref3, product_reference_4 AS ref4, product_reference_5 AS ref5, 
               product_reference_6 AS ref6, product_reference_7 AS ref7, currency_country_name AS countryName, currency_iso_alpha_2_code AS isoAlpha2Code
        FROM platform_product_info JOIN platform_currency ON product_currency_id = currency_country_id
        WHERE 
            product_id = ?
        AND product_category_id IN (${config.categoryIdMapping.INTERNET}, ${config.categoryIdMapping.BUNDLE})
        AND product_status = 1
    `,
  productInfoForZulu: `
        SELECT product_id AS productId, product_name AS productName, product_category_id AS productCategoryId, product_execution_id AS executionConfigId, 
               product_value AS amount, product_sales_value AS salesAmount, product_variable_amount AS variableAmount,  
               product_minimum_value AS minimumValue, product_maximum_value AS maximumValue, product_probable_amounts AS probableAmounts, product_currency_id AS currencyId,
               product_reference_1 AS ref1, product_reference_2 AS ref2, product_reference_3 AS ref3, product_reference_4 AS ref4, product_reference_5 AS ref5, 
               product_reference_6 AS ref6, product_reference_7 AS ref7, currency_country_name AS countryName, currency_iso_alpha_2_code AS isoAlpha2Code
        FROM platform_product_info JOIN platform_currency ON product_currency_id = currency_country_id
        WHERE 
            product_id = ?
        AND product_category_id = ${config.categoryIdMapping.SERVICE_A}
        AND product_status = 1
    `,
  dataPackList: function (userId, roleId, whereCondition) {
    // return `
    //     SELECT product_id AS id, product_name AS name, product_description AS description, product_reference_1 AS operator, currency_country_name AS country
    //     FROM platform_product_info JOIN platform_currency ON product_currency_id = currency_country_id
    //     ${whereCondition}
    // `;

    // return `
    //     SELECT
    //         pi.product_id AS id, pi.product_name AS name, pi.product_description AS description, pi.product_reference_1 AS operator,
    //         c.currency_country_name AS country, pi.product_value AS productValue, pi.product_sales_value AS productSalesValue,
    //         pi.product_comission_applicable AS isComissionApplicable, pi.product_discount_applicable AS isDiscountApplicable,
    //         pr.rate_applicable_type AS commissionRateApplicablity,
    //         pc.charge_type as product_charge_type,
    // 	    IFNULL(IF(pc.charge_type = 'fixed', pc.charge_amount, (pc.charge_amount)/100), 0) as productChargeableRate,
    //     platform_round_amount(IFNULL(IF(pc.charge_type = 'fixed', pc.charge_amount, pi.product_sales_value * (pc.charge_amount)/100), 0), '-1') as productServiceCharge, pr.rate_amount AS commissionRateAmount,
    //     CAST(platform_currency_convertion(${userId}, platform_round_amount(IF (pr.rate_amount IS NULL, pi.product_sales_value, pi.product_sales_value -
    //         (IF (pr.rate_applicable_type = 1, (pi.product_sales_value * pr.rate_amount) / 100, IF (pr.rate_applicable_type = 0, pr.rate_amount, 0))
    //                ) + IFNULL(IF(pc.charge_type = 'fixed', pc.charge_amount, ((platform_round_amount(IF(pr.rate_amount IS NULL,
    //     pi.product_sales_value, pi.product_sales_value - (IF(pr.rate_applicable_type = 1, (pi.product_sales_value * pr.rate_amount) / 100, IF(pr.rate_applicable_type = 0, pr.rate_amount, 0)))), -1)) * (pc.charge_amount)/100)), 0)), -1) ,'-1') AS DECIMAL(10,2)) AS price
    //     FROM platform_product_info as pi
    // 	JOIN platform_currency as c ON pi.product_currency_id = c.currency_country_id
    // 	LEFT JOIN platform_product_rates AS pr
    //         ON pi.product_id = pr.rate_productid AND pi.product_comission_applicable = 1
    //         AND pr.rate_roleid = ${roleId}
    //         AND pr.rate_type = 'comission'
    //         AND pr.rate_status = 1
    // 	LEFT JOIN platform_product_charges as pc on pi.product_id = pc.product_id and pc.status=1
    //     ${whereCondition}
    // `;

    return `
            SELECT pi.product_id AS id, pi.product_name AS name, pi.product_description AS description, pi.product_reference_1 AS operator, 
			c.currency_country_name AS country, 
			CAST(platform_currency_convertion(${userId}, platform_round_amount(IF (pr.rate_amount IS NULL, pi.product_sales_value, pi.product_sales_value -
                (IF (pr.rate_applicable_type = 1, (pi.product_sales_value * pr.rate_amount) / 100, IF (pr.rate_applicable_type = 0, pr.rate_amount, 0))
                       ) + IFNULL(IF(pc.charge_type = 'fixed', pc.charge_amount, ((platform_round_amount(IF(pr.rate_amount IS NULL,
            pi.product_sales_value, pi.product_sales_value - (IF(pr.rate_applicable_type = 1, (pi.product_sales_value * pr.rate_amount) / 100, IF(pr.rate_applicable_type = 0, pr.rate_amount, 0)))), -1)) * (pc.charge_amount)/100)), 0)), -1) ,'-1') AS DECIMAL(10,2)) AS price
            FROM platform_product_info as pi
			JOIN platform_currency as c ON pi.product_currency_id = c.currency_country_id
			LEFT JOIN platform_product_rates AS pr
                ON pi.product_id = pr.rate_productid AND pi.product_comission_applicable = 1
                AND pr.rate_roleid = ${roleId}
                AND pr.rate_type = 'comission'
                AND pr.rate_status = 1
			LEFT JOIN platform_product_charges as pc on pi.product_id = pc.product_id and pc.status=1
            ${whereCondition}
        `;
  },
  productInfoUsingOperatorCode: `
        SELECT product_id AS productId, product_name AS productName, product_category_id AS productCategoryId, product_variable_amount AS variableAmount, 
               product_minimum_value AS minimumValue, product_maximum_value AS maximumValue, product_probable_amounts AS probableAmounts, product_currency_id AS currencyId,
               product_reference_1 AS ref1, product_reference_2 AS ref2
        FROM platform_product_info
        WHERE 
            product_reference_3 = ?
        AND product_category_id = ${config.categoryIdMapping.TOP_UP} 
        AND product_status = 1
        ORDER BY product_id DESC
        LIMIT 1
    `,
  fetchProductRates: function (whereCondition) {
    return `
            SELECT pr.rate_id AS productRatesId, 
                   CASE pr.rate_type
                       WHEN 'comission' THEN 'Commission'
                       WHEN 'discount' THEN 'Discount'
                   END AS rateType,
                   pr.rate_productid AS productId, pi.product_name AS productName, 
                   pr.rate_roleid AS roleId, r.role_name AS roleName, pr.rate_userid AS userId, 
                   pr.rate_amount AS comissionRate, pr.rate_priority AS priority,
                   CASE pr.rate_applicable_type 
                       WHEN 0 THEN 'Fixed'
                       WHEN 1 THEN 'Percent'
                   END AS rateApplicableType,
                   CASE pr.rate_status
                       WHEN 0 THEN 'Inactive'
                       WHEN 1 THEN 'Active'
                   END AS status,
                   pr.created_by AS createdBy, pr.creation_date AS createdAt, pr.updated_by AS updatedBy, pr.last_update_date AS updatedAt
            FROM platform_product_rates AS pr 
            JOIN platform_product_info AS \`pi\` ON pr.rate_productid = pi.product_id
            JOIN platform_product_category AS pc ON pi.product_category_id = pc.category_id
            LEFT JOIN platform_roles AS r ON pr.rate_roleid = r.role_id
            ${whereCondition}
        `;
  },
  createPackageOrder: `
        INSERT INTO platform_package_order(package_id, execution_ref_id, requested_user_id, created_by)
        VALUES(?, ?, ?, ?)
    `,
  createPackageOrderDetails: `
        INSERT INTO platform_package_order_details(package_order_id, package_product_id, created_by)
        VALUES(?, ?, ?)
    `,
  fetchPackageOrder: `
        SELECT pod.package_order_details_id AS packageOrderDetailsId, po.package_order_id AS packageOrderId, 
               po.package_id AS packageId, po.execution_ref_id AS executionRefId, po.requested_user_id AS requestedUserId
        FROM platform_package_order AS po JOIN platform_package_order_details AS pod ON po.package_order_id = pod.package_order_id
        WHERE po.execution_ref_id = ? AND po.requested_user_id = ? AND pod.executed_product_id = ?
    `,
  updatePackageOrderDetailsUsingId: `UPDATE platform_package_order_details
        SET executed_product_id = ?,
        execution_id = ?,
        execution_status = ?,
        updated_by = ?,
        last_update_date = NOW()
        WHERE package_order_details_id = ? AND execution_status != 1`,
  fetchPackageOrderDetails: `
        SELECT po.execution_ref_id AS executionRefId, pi.product_value AS amount, 
               pi.product_category_id AS productCategoryId, pi.product_currency_id AS currencyId
        FROM platform_package_order AS po 
        JOIN platform_package_order_details AS pod ON po.package_order_id = pod.package_order_id
        JOIN platform_product_info AS pi ON pod.package_product_id = pi.product_id
        WHERE pod.package_order_details_id = ? AND po.requested_user_id = ? AND pod.execution_status = 3
    `,
  fetchProductChargesInfo: `
        SELECT charge_amount FROM platform_product_charges WHERE product_id= ? AND channel= ? AND status= ?
    `,
  keyForCachedChannelList: "channels.all",
  channelList: `
        SELECT channel_iso_alpha_2_code AS isoAlpha2Code, channel_name AS name, channel_image AS image, channel_link AS link
        FROM platform_channels WHERE channel_status = 1
    `,
};
