import { Database, Statement } from 'node:sqlite';
import * as sqlite from 'node:sqlite';
import type * as other from './types.js';

const db: Database = new Database(':memory:');
function run(statement: Statement): sqlite.Statement {
	return statement;
}
let legacy: other.DatabaseSync;
