import { DatabaseSync, type StatementSync } from 'node:sqlite';
import * as sqlite from 'node:sqlite';
import type * as other from './types.js';

const db: DatabaseSync = new DatabaseSync(':memory:');
function run(statement: StatementSync): sqlite.StatementSync {
	return statement;
}
let legacy: other.DatabaseSync;
