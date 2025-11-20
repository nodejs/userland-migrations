const net = await import("node:net");

module.exports = {
  createServer: () => net.createServer()
};