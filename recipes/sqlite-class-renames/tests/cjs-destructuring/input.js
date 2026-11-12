const { DatabaseSync: DB, StatementSync } = require('node:sqlite');

const db = new DB(':memory:');
module.exports = { isStatement: (value) => value instanceof StatementSync };
