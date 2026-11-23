const { DatabaseSync, StatementSync } = require('node:sqlite');

function open(DatabaseSync) {
	return new DatabaseSync(':memory:');
}

const db = open(DatabaseSync);
const check = (value) => value instanceof StatementSync;
