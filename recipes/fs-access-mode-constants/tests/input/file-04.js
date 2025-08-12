const { accessSync, F_OK, R_OK } = require('node:fs');
const fs = require('node:fs');

accessSync('/path/to/file', F_OK);
fs.access('/path/to/file', fs.W_OK | R_OK, callback);