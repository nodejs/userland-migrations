const tls = require('node:tls');

const subject = 'C=US/ST=California/L=San Francisco/O=Example/CN=example.com';
const parsed = /* DEP0076: use node:crypto X509Certificate for robust parsing */ Object.fromEntries(String(subject).split('/').filter(Boolean).map((pair) => pair.split('=')));
console.log(parsed);
