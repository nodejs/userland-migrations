import { Duplex } from 'node:stream';

const pair = Duplex.toWeb(stream, { type: 'bytes' });
