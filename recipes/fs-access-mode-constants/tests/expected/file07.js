import { constants } from 'node:fs';

const readable = constants.R_OK;
const writable = constants.W_OK;
const executable = constants.X_OK;
const exists = constants.F_OK;