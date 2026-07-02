const { createSecurePair: csp } = require('node:tls');

// Using an alias in CJS
const pair = csp(credentials, true);
