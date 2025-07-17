const { createRequireFromPath, otherFunction } = require('node:module');

const require = createRequireFromPath(__filename);
const pkg = require('./package.json');
