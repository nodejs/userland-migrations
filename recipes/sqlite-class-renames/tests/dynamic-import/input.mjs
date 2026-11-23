const { DatabaseSync } = await import('node:sqlite');
const sqlite = await import('node:sqlite');

const db = new DatabaseSync(':memory:');
const check = (value) => value instanceof sqlite.StatementSync;
