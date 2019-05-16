'use strict';

/**
 * MSISDN identification table.
 *
 * Used by lib/phonenumber.js and lib/genericphonenumber.js to normalise an
 * inbound number and resolve which operator it belongs to before a request is
 * routed.
 *
 * Two switches per country, and they are independent on purpose:
 *
 *  - `checkOperator`  the number must resolve to a known operator. Enabled for
 *                     markets where routing depends on the operator.
 *  - `checkPrefix`    the subscriber prefix must match a known one. Enabled
 *                     where prefix ranges are stable and reliable.
 *
 * A market can be served without either check being on (see COUNTRY_C below):
 * the country is recognised and the number normalised, but operator resolution
 * is left to the downstream provider. That is the correct default when a
 * regulator permits number portability across operators, because a prefix no
 * longer proves which network a number is actually on.
 *
 * Only a short generic sample is kept in this reference implementation; the
 * real file carries the full published prefix ranges per market.
 */
module.exports = {
  clean: true,
  identifiers: {
    COUNTRY_A: {
      isoAlpha2CountryCode: "AA",
      countryName: "Country A",
      countryCode: "100",
      checkOperator: true,
      checkPrefix: true,
      operators: [
        {
          name: "Operator A1",
          code: "OPERATOR_A1",
          prefixes: ["11", "12"],
        },
        {
          name: "Operator A2",
          code: "OPERATOR_A2",
          prefixes: ["13"],
        },
        {
          name: "Operator A3",
          code: "OPERATOR_A3",
          prefixes: ["14"],
        },
      ],
    },
    COUNTRY_B: {
      isoAlpha2CountryCode: "BB",
      countryName: "Country B",
      countryCode: "200",
      checkOperator: true,
      checkPrefix: false,
      operators: [
        {
          name: "Operator B1",
          code: "OPERATOR_B1",
          prefixes: [],
        },
        {
          name: "Operator B2",
          code: "OPERATOR_B2",
          prefixes: [],
        },
      ],
    },
    COUNTRY_C: {
      isoAlpha2CountryCode: "CC",
      countryName: "Country C",
      countryCode: "300",
      checkOperator: false,
      operators: [],
    },
  },
};
