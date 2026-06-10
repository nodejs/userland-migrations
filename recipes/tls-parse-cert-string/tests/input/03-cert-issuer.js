const tls = require('node:tls');

const cert = socket.getPeerCertificate();
const issuer = tls.parseCertString(cert.issuer);
