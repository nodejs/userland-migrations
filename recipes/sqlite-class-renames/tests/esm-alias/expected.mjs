import { Database as DB, Statement as Stmt } from 'node:sqlite';

const db = new DB(':memory:');
console.log(db.prepare('SELECT 1') instanceof Stmt);
