const { createRequire, otherFunction } = require('node:module');

const require = createRequire(__filename);
const pkg = require('./package.json');
