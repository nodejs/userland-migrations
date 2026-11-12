import { Database, Statement as Stmt } from 'node:sqlite';
import { Database as DatabaseSync } from 'node:sqlite';

export { Database as DatabaseSync2 } from 'node:sqlite';

const db = new Database(':memory:');
console.log(db instanceof DatabaseSync, Stmt);
