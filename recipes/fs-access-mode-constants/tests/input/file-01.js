import * as fs from 'node:fs';

fs.access('/path/to/file', fs.F_OK, callback);
fs.access('/path/to/file', fs.X_OK, callback);