"use strict";

function handleDatabaseError(err, callback) {

  const errorMap = {
    ER_NO_SUCH_TABLE:
      "Service temporarily unavailable. Please try again later.",
    ER_BAD_FIELD_ERROR: "Invalid data field requested. Please contact support.",
    ER_ACCESS_DENIED_ERROR:
      "Database connection issue. Please contact support.",
    ER_BAD_DB_ERROR: "Database configuration issue. Please contact support.",
    ER_DBACCESS_DENIED_ERROR: "Database access denied. Please contact support.",
    ER_CON_COUNT_ERROR:
      "Too many database connections. Please try again later.",
    ER_DB_CREATE_EXISTS:
      "Database already exists error. Please contact support.",
    ER_CANT_CREATE_DB: "Cannot create database. Please contact support.",
    ER_WRONG_DB_NAME: "Incorrect database name. Please contact support.",
    ER_TABLE_EXISTS_ERROR:
      "Table already exists error. Please contact support.",
    ER_DUP_ENTRY: "Duplicate entry detected. Please check your data.",
    ER_NO_REFERENCED_ROW: "Referenced data not found. Please check your input.",
    ER_ROW_IS_REFERENCED:
      "Cannot delete referenced data. Please contact support.",
    ER_DATA_TOO_LONG: "Data too long for column. Please check your input.",
    ER_BAD_NULL_ERROR: "Required field is missing. Please check your input.",
    ER_NO_DEFAULT_FOR_FIELD:
      "No default value for field. Please check your input.",
    ER_LOCK_WAIT_TIMEOUT: "Database lock timeout. Please try again later.",
    ER_LOCK_DEADLOCK: "Database deadlock. Please try again later.",
    ER_QUERY_INTERRUPTED: "Query interrupted. Please try again.",
    ECONNREFUSED: "Database connection refused. Please try again later.",
    ETIMEDOUT: "Database connection timeout. Please try again later.",
    PROTOCOL_CONNECTION_LOST:
      "Database connection lost. Please try again later.",
    ER_PARSE_ERROR: "Query syntax error. Please contact support.",
    ER_WRONG_VALUE_COUNT: "Incorrect number of values. Please contact support.",
    ER_WRONG_VALUE: "Invalid value provided. Please check your input.",
    ER_TRUNCATED_WRONG_VALUE:
      "Data truncated due to incorrect value. Please check your input.",
    ER_WRONG_FIELD_WITH_GROUP:
      "Invalid field in GROUP BY clause. Please contact support.",
    ER_CANT_AGGREGATE_2COLLATIONS:
      "Collation conflict in aggregation. Please contact support.",
    ER_MIX_OF_GROUP_FUNC_AND_FIELDS:
      "Mixed group functions and fields. Please contact support.",
    ER_DUP_KEYNAME: "Duplicate key name. Please contact support.",
    ER_SYNTAX_ERROR: "SQL syntax error. Please contact support.",
    ER_NO_SUCH_INDEX: "Index does not exist. Please contact support.",
    ER_CANT_DROP_FIELD_OR_KEY:
      "Cannot drop field or key. Please contact support.",
    ER_WRONG_AUTO_KEY: "Incorrect auto-increment key. Please contact support.",
    ER_FIELD_SPECIFIED_TWICE:
      "Field specified multiple times. Please contact support.",
    ER_UNKNOWN_TABLE: "Unknown table referenced. Please contact support.",
    ER_NON_UNIQ_ERROR: "Non-unique result. Please contact support.",
    ER_NONEXISTING_GRANT: "Grant does not exist. Please contact support.",
    ER_TABLE_NOT_LOCKED: "Table is not locked. Please contact support.",
  };

  const userMessage =
    errorMap[err.code] ||
    "A temporary system error occurred. Please try again later.";

  const errorResponse = {
    status: 500,
    code: "255",
    title: "Internal Server Error",
    details: userMessage,
    timestamp: Math.floor(Date.now() / 1000),
  };

  return callback(errorResponse);
}

module.exports = {
  handleDatabaseError,
};
