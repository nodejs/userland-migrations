const { createRequireFromPath } = require('module');

const require = createRequireFromPath('/path/to/module');
const myModule = require('./myModule.cjs');
