import { DatabaseSync } from 'node:sqlite';

export { StatementSync } from 'node:sqlite';
export { DatabaseSync as SqliteDatabase } from 'node:sqlite';
export { DatabaseSync };
export const api = { DatabaseSync, open: () => new DatabaseSync(':memory:') };
