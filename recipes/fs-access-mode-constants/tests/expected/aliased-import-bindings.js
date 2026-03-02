import { access, constants } from 'node:fs';

access('/path/to/file', constants.F_OK | constants.X_OK, callback);
