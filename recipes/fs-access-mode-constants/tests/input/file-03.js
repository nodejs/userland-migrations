import { access, F_OK, R_OK, W_OK, X_OK } from 'node:fs';

access('/path/to/file', F_OK, callback);
access('/path/to/file', R_OK | W_OK | X_OK, callback);