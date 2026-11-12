import * as sqlite from 'node:sqlite';
import nodeSqlite from 'node:sqlite';

const db = new sqlite.Database(':memory:');
const other = new nodeSqlite.Database(':memory:');
console.log(db.prepare('SELECT 1') instanceof sqlite.Statement);
console.log(sqlite.constants, other.DatabaseSync);
