import * as stream from 'stream';

const pair = stream.Duplex.toWeb(source, { readableType: 'bytes', highWaterMark: 16 });
