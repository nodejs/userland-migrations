const { createRequire } = require('module');

// no semicolon is needed for test
const require = createRequire('/path/to/module')
const myModule = require('./myModule.cjs');
