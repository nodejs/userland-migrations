import {
	Agent,
	ClientRequest,
	IncomingMessage,
	OutgoingMessage,
	Server,
	ServerResponse,
} from "node:http";

const agent = Agent();
const request = ClientRequest(options);
const incoming = IncomingMessage(socket);
const message = OutgoingMessage();
const server = Server();
const response = ServerResponse(socket);
