const net = await import("node:net");

net._setSimultaneousAccepts(false);
module.exports = {
  createServer: () => net.createServer()
};
