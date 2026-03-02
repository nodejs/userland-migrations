import { access, F_OK as fileExists, X_OK as canExec } from 'node:fs';

access('/path/to/file', fileExists | canExec, callback);
