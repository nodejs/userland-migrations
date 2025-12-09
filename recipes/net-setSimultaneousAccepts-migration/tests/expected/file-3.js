const net = require("node:net");

module.exports = {
  createServer: () => net.createServer()
};