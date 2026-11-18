import { Duplex as D } from 'node:stream';

const kind: 'bytes' = 'bytes';
const direct = D.toWeb(stream as D, { type: kind });
