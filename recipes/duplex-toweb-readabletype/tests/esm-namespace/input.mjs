import * as stream from 'stream';

const pair = stream.Duplex.toWeb(source, { type: 'bytes', highWaterMark: 16 });
