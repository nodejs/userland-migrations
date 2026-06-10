const tls = require('node:tls');

const subject = 'C=US/ST=California/L=San Francisco/O=Example/CN=example.com';
const parsed = tls.parseCertString(subject);
console.log(parsed);
