const fs = require("fs");
const path = require("path");

const schemas = {};

fs.readdirSync(__dirname)
  .filter((file) => file.endsWith(".schema.js")) // only load schema files
  .forEach((file) => {
    const schemaModule = require(path.join(__dirname, file));
    Object.assign(schemas, schemaModule); // merging all exports into one object
  });

module.exports = schemas;
