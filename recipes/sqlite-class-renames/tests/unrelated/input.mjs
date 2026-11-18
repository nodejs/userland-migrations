import { DatabaseSync } from 'sqlite';
import { StatementSync } from './local.js';

const thirdParty = require('sqlite').DatabaseSync;
const config = { DatabaseSync: true };
console.log(config.DatabaseSync, new DatabaseSync(), StatementSync);
