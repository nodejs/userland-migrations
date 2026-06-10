const { parseCertString: pcs, createServer } = require('node:tls');

const parsed = pcs('C=US/CN=test');
createServer(() => {});
