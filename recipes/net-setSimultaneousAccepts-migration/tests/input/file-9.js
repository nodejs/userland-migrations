const net = require("node:net");
const simultaneousAccepts = require("some-module");

function setupServer(config) {
  net._setSimultaneousAccepts(simultaneousAccepts);
  return net.createServer().listen(8080);
}