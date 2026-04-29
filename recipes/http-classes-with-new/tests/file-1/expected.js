const http = require("node:http");

const agent = new http.Agent();
const request = new http.ClientRequest(options);
const incoming = new http.IncomingMessage(socket);
const message = new http.OutgoingMessage();
const server = new http.Server();
const response = new http.ServerResponse(socket);
