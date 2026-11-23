const sqlite = require('node:sqlite');

const db = new sqlite.DatabaseSync(':memory:');
const Stmt = require('node:sqlite').StatementSync;
