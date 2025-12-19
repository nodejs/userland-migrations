const net = require("node:net");

const server = net.createServer();

server.on('error', (err) => {
  console.error(err);
});


server.maxConnections = 10;
server.listen(8080, '0.0.0.0');

const socket = new net.Socket();
socket.connect(8080, 'localhost');
socket.setTimeout(3000);
