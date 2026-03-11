const net = require("node:net");

net._setSimultaneousAccepts(true);

const server = net.createServer((socket) => {
  socket.on('data', (data) => {
    console.log(data);
  });
  socket.write('Hello World!');
  socket.end();
});

server.listen(3000, () => {
  console.log('Server listening on port 3000');
});

server.on('connection', (socket) => {
  console.log('New connection');
});
