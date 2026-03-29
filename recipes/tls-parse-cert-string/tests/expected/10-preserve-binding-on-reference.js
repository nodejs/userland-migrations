const { parseCertString } = require('node:tls');

const parser = parseCertString;
const parsed = /* DEP0076: use node:crypto X509Certificate for robust parsing */ Object.fromEntries(String('C=US/CN=test').split('/').filter(Boolean).map((pair) => pair.split('=')));
