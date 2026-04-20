import tls, { createServer } from 'node:tls';

const server = createServer(options);
const pair = tls.createSecurePair(credentials);
