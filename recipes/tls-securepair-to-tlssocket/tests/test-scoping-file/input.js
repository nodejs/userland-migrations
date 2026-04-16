const tls = require('node:tls');

class ConnectionManager {
  constructor() {
    if (true) {
      const pair = new tls.SecurePair();
      this.init(pair);
      
      if (pair.cleartext) {
        console.log("cleaning");
      }
    }
  }
}