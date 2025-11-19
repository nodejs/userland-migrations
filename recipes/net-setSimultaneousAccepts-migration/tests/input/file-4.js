const net = require("node:net");

function initializeApp() {
  net._setSimultaneousAccepts(true);
  const server = net.createServer();
  server.listen(3000);
}