const net = require("node:net");

const simultaneousAccepts = false;

function setupServer(config) {
  net._setSimultaneousAccepts(simultaneousAccepts);
  return net.createServer().listen(simultaneousAccepts);
}