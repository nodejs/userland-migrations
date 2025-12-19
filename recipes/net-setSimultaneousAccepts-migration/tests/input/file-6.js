const net = require("node:net");

const config = {
  simultaneousAccepts: false,
  port: 8080
};

function setupServer(config) {
  net._setSimultaneousAccepts(config.simultaneousAccepts);
  return net.createServer().listen(config.port);
}
