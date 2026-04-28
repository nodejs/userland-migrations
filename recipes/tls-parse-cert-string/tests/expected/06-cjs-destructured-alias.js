const { createServer } = require('node:tls');

const parsed = /* DEP0076: use node:crypto X509Certificate for robust parsing */ Object.fromEntries(String('C=US/CN=test').split('/').filter(Boolean).map((pair) => pair.split('=')));
createServer(() => {});
