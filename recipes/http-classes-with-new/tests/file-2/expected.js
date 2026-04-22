import {
	Agent,
	ClientRequest,
	IncomingMessage,
	OutgoingMessage,
	Server,
	ServerResponse,
} from "node:http";

const agent = new Agent();
const request = new ClientRequest(options);
const incoming = new IncomingMessage(socket);
const message = new OutgoingMessage();
const server = new Server();
const response = new ServerResponse(socket);
