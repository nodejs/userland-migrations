const { Database } = await import('node:sqlite');
const sqlite = await import('node:sqlite');

const db = new Database(':memory:');
const check = (value) => value instanceof sqlite.Statement;
