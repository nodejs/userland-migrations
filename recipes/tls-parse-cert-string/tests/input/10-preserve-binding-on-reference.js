const { parseCertString } = require('node:tls');

const parser = parseCertString;
const parsed = parseCertString('C=US/CN=test');
