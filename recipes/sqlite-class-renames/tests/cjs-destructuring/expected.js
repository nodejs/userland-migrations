const { Database: DB, Statement } = require('node:sqlite');

const db = new DB(':memory:');
module.exports = { isStatement: (value) => value instanceof Statement };
