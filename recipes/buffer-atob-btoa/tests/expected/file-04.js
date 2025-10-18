import buffer from "node:buffer";
buffer.constants.MAX_LENGTH;
const data = 'Hello World!';
Buffer.from(data, 'binary').toString('base64');