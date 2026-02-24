const net = require("node:net");

class ServerManager {
  constructor() {
    this.server = net.createServer();
  }

  start(port) {
    this.server.listen(port);
  }

  getAddress() {
    return this.server.address();
  }

  stop() {
    this.server.close();
  }
}

module.exports = ServerManager;
