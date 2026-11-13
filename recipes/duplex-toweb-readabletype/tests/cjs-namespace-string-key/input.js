const stream = require('node:stream');

const pair = stream.Duplex.toWeb(source, { 'type': getType() });
const other = stream.Duplex.toWeb(source, { "type": "bytes" });
