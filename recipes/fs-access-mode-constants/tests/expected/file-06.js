const fs = require('node:fs');

const mode = fs.constants.R_OK | fs.constants.W_OK;
if (condition) {
  fs.accessSync('/path/to/file', fs.constants.F_OK);
}