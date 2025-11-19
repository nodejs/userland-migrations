const net = require("node:net");

net._setSimultaneousAccepts(false);
const server = net.createServer();