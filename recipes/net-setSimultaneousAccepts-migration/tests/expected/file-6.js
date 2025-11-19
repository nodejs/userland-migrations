const net = require("node:net");

const config = {
  port: 8080
};

function setupServer(config) {
  return net.createServer().listen(config.port);
}