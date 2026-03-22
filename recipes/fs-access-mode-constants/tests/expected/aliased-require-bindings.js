const { access, constants } = require('node:fs');

access('/path/to/file', constants.F_OK | constants.R_OK, callback);
