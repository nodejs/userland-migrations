import { Database } from 'node:sqlite';

export { Statement as StatementSync } from 'node:sqlite';
export { Database as SqliteDatabase } from 'node:sqlite';
export { Database as DatabaseSync };
export const api = { DatabaseSync: Database, open: () => new Database(':memory:') };
