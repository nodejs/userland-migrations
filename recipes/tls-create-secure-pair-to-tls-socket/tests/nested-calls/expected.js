const tls = require('node:tls');

function setupTLS() {
    const socket = new tls.TLSSocket(underlyingSocket, { secureContext: credentials });
    return pair;
}

class TLSManager {
    init() {
        this.pair = new tls.TLSSocket(underlyingSocket, { secureContext: credentials, isServer: true });
    }
}
