import { F_OK, R_OK, W_OK, X_OK } from 'node:fs';

const readable = R_OK;
const writable = W_OK;
const executable = X_OK;
const exists = F_OK;