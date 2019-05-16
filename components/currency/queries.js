'use strict';

module.exports = {
    createCurrency: `
        INSERT INTO platform_currency(currency_name, currency_description, currency_status, currency_base, currency_conversion_rate, 
        currency_country_name, currency_country_code, currency_iso_alpha_2_code, created_by)
        VALUES(?, ?, 1, 0, ?, ?, ?, ?, ?)
    `,
    updateCurrency: `
        UPDATE platform_currency
        SET currency_name = IF(? IS NULL, currency_name, ?),
            currency_description = IF(? IS NULL, currency_description, ?),
            currency_status = IF(? IS NULL, currency_status, ?),
            currency_conversion_rate = IF(? IS NULL, currency_conversion_rate, ?),
            currency_country_name = IF(? IS NULL, currency_country_name, ?),
            currency_country_code = IF(? IS NULL, currency_country_code, ?),
            currency_iso_alpha_2_code = IF(? IS NULL, currency_iso_alpha_2_code, ?),
            updated_by = ?
        WHERE currency_country_id = ? AND currency_base != 1
    `,
    fetchCurrencyList: function (whereCondition) {
        return `SELECT currency_country_id AS currencyId, currency_name AS currencyName, currency_description AS currencyDescription, 
                currency_status AS status, currency_base AS isBaseCurrency, currency_conversion_rate AS currencyConversionRate,
                currency_country_name AS countryName, currency_country_code AS countryCode, currency_iso_alpha_2_code AS isoAlpha2Code
                FROM platform_currency ${whereCondition}
            `
    },
    verifyCurrencyId: `
        select 1 from platform_currency where currency_country_id = ? AND currency_status = 1
    `,
    currencyIdUsingCountry: `
        SELECT currency_country_id AS currencyId 
        FROM platform_currency 
        WHERE currency_country_name = ? AND currency_status = 1
    `,
    currencyConversionRateById:`SELECT ROUND(currency_conversion_rate,2) AS currencyConvertionRate 
        FROM platform_currency 
        WHERE currency_country_id = ? AND currency_status = 1`
};