const sqlite = require('node:sqlite');

const db = new sqlite.Database(':memory:');
const Stmt = require('node:sqlite').Statement;
