const net = require("node:net");

function initializeApp() {
  const server = net.createServer();
  server.listen(3000);
}
