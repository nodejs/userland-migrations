const { createRequireFromPath } = require('module');

// no semicolon is needed for test
const require = createRequireFromPath('/path/to/module')
const myModule = require('./myModule.cjs');
