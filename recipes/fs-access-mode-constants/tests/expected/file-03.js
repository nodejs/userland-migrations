import { access, constants } from 'node:fs';

access('/path/to/file', constants.F_OK, callback);
access('/path/to/file', constants.R_OK | constants.W_OK | constants.X_OK, callback);