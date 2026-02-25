const fs = require('node:fs');

fs.accessSync('/path/to/file', fs.constants.X_OK);
