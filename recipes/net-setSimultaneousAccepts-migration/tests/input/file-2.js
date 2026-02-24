const net = require("node:net");

function createServer() {
  net._setSimultaneousAccepts(true);
  return net.createServer((socket) => {
    // handle connection
  });
}
