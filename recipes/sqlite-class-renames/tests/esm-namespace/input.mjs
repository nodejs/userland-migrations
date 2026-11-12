import * as sqlite from 'node:sqlite';
import nodeSqlite from 'node:sqlite';

const db = new sqlite.DatabaseSync(':memory:');
const other = new nodeSqlite.DatabaseSync(':memory:');
console.log(db.prepare('SELECT 1') instanceof sqlite.StatementSync);
console.log(sqlite.constants, other.DatabaseSync);
