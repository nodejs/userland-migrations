import { createRequireFromPath } from 'module';

const require = createRequireFromPath(import.meta.url);
const data = require('./data.json');
