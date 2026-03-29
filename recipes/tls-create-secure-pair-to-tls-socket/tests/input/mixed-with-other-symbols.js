const { createSecurePair, createServer } = require('node:tls');
const pair = createSecurePair(credentials);
const server = createServer(options);
