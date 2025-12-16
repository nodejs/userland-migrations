onst { SecurePair } = require('node:tls');

// Completely arbitrary variable name
const item = new SecurePair();

// Usage
item.doSomething();
item.cleartext.read();