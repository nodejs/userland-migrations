const tls = require('tls')

const securePair = tls.createSecurePair(
	tls.createSecureContext(options),
	true,   /* isServer */
	false,  // requestCert
	false   // rejectUnauthorized
)
