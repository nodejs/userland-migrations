const { accessSync, constants } = require('node:fs');
const fs = require('node:fs');

accessSync('/path/to/file', constants.F_OK);
fs.access('/path/to/file', fs.constants.W_OK | constants.R_OK, callback);