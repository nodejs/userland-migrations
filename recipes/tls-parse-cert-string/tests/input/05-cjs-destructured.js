const { parseCertString } = require('node:tls');

const result = parseCertString('C=US/CN=test');
