import { DatabaseSync as DB, StatementSync as Stmt } from 'node:sqlite';

const db = new DB(':memory:');
console.log(db.prepare('SELECT 1') instanceof Stmt);
