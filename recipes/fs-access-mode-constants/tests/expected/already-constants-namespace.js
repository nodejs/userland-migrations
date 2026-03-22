import * as fs from 'node:fs';

fs.access('/path/to/file', fs.constants.F_OK, callback);
fs.access('/path/to/file', fs.constants.R_OK | fs.constants.W_OK, callback);
