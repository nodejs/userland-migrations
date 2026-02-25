import { promises as fsPromises, F_OK, R_OK } from 'node:fs';

await fsPromises.access('/path/to/file', F_OK);