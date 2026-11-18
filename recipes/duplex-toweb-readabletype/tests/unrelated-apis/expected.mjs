import { Duplex, Readable } from 'node:stream';
import { Duplex as Other } from './my-duplex.js';

const readable = Readable.toWeb(stream, { type: 'bytes' });
const local = Other.toWeb(stream, { type: 'bytes' });
const unrelated = { type: 'bytes' };
const first = Duplex.toWeb(stream, { encoding: 'utf8' }, { type: 'bytes' });
