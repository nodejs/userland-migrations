const http = require("node:http");

const agent = http.Agent();
const request = http.ClientRequest(options);
const incoming = http.IncomingMessage(socket);
const message = http.OutgoingMessage();
const server = http.Server();
const response = http.ServerResponse(socket);
