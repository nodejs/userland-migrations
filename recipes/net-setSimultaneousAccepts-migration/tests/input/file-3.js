const net = require("node:net");

net._setSimultaneousAccepts(false);
module.exports = {
  createServer: () => net.createServer()
};