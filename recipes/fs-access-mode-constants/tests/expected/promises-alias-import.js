import { promises as fsPromises } from 'node:fs';

await fsPromises.access('/path/to/file', fsPromises.constants.F_OK);