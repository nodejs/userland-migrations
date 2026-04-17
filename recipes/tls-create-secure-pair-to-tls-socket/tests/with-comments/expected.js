const tls = require('tls')

const securePair = new tls.TLSSocket(underlyingSocket, { secureContext: tls.createSecureContext(options), isServer: true, requestCert: false, rejectUnauthorized: false })
