const net = require("node:net");

const simultaneousAccepts = false;

function setupServer(config) {
  return net.createServer().listen(simultaneousAccepts);
}
