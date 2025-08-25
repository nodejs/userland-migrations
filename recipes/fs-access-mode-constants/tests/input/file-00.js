const fs = require('node:fs');

fs.access('/path/to/file', fs.F_OK, callback);
fs.access('/path/to/file', fs.R_OK | fs.W_OK, callback);