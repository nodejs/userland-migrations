const { Duplex: NodeDuplex } = require('stream');
const type = 'bytes';

const pair = NodeDuplex.toWeb(stream, { type });
