const { access, F_OK: fileExists, R_OK: canRead } = require('node:fs');

access('/path/to/file', fileExists | canRead, callback);
