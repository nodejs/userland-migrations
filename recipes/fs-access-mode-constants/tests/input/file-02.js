const { access, F_OK, R_OK, W_OK } = require('node:fs');

access('/path/to/file', F_OK, callback);
access('/path/to/file', R_OK | W_OK, callback);