import('node:tls').then(function (tls) {
    const socket = new tls.TLSSocket(underlyingSocket, { secureContext: credentials });
});
