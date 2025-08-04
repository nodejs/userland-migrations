const fs = require('node:fs');

const mode = fs.R_OK | fs.W_OK;
if (condition) {
  fs.accessSync('/path/to/file', fs.F_OK);
}