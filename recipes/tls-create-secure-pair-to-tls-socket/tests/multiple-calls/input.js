const { createSecurePair } = require('node:tls');

// Multiple calls with different arguments
const pair1 = createSecurePair();
const pair2 = createSecurePair(credentials);
const pair3 = createSecurePair(credentials, true);
const pair4 = createSecurePair(credentials, true, false);
const pair5 = createSecurePair(credentials, true, false, true);
