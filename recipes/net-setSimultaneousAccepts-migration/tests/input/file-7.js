const net = require("node:net");

let simultaneousAccepts = false;

function setupServer(config) {
  net._setSimultaneousAccepts(simultaneousAccepts);
  return net.createServer().listen(8080);
}
