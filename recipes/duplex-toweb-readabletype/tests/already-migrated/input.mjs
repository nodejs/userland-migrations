import { Duplex } from 'node:stream';

const pair = Duplex.toWeb(stream, { readableType: 'bytes' });
const plain = Duplex.toWeb(stream);
