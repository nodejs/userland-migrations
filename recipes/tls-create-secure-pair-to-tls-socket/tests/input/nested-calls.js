const tls = require('node:tls');

function setupTLS() {
    const pair = tls.createSecurePair(credentials);
    return pair;
}

class TLSManager {
    init() {
        this.pair = tls.createSecurePair(credentials, true);
    }
}
