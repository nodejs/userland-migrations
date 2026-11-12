const stream = require('node:stream');

const pair = stream.Duplex.toWeb(source, { 'readableType': getType() });
const other = stream.Duplex.toWeb(source, { "readableType": "bytes" });
