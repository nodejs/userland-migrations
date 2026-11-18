import { DatabaseSync, StatementSync } from 'node:sqlite';

const db = new DatabaseSync(':memory:');
const statement = db.prepare('SELECT 1');
console.log(statement instanceof StatementSync);
