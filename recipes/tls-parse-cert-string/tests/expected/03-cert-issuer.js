const tls = require('node:tls');

const cert = socket.getPeerCertificate();
const issuer = /* DEP0076: cert.subject/cert.issuer are already parsed */ cert.issuer;
