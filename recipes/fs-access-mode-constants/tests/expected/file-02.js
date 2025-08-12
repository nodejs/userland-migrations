const { access, constants } = require('node:fs');

access('/path/to/file', constants.F_OK, callback);
access('/path/to/file', constants.R_OK | constants.W_OK, callback);