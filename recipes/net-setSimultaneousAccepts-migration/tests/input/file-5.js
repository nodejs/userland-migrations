import net from "node:net";

net._setSimultaneousAccepts(false);
const server = net.createServer();
