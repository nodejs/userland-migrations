import { Database, Statement } from 'node:sqlite';

const db = new Database(':memory:');
const statement = db.prepare('SELECT 1');
console.log(statement instanceof Statement);
