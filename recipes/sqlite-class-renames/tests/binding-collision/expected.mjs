import Database from 'better-sqlite3';
import { Database as DatabaseSync, Statement as StatementSync } from 'node:sqlite';

const legacy = new Database('app.db');
const db = new DatabaseSync(':memory:');
const Statement = db.prepare('SELECT 1');
console.log(Statement instanceof StatementSync);
