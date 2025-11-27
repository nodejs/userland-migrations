const net = require("node:net");

function setupServer(config) {
  return net.createServer().listen(8080);
}