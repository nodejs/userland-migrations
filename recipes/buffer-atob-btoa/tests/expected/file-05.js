import { isUtf8 } from "node:buffer";
const data = 'Hello World!';
isUtf8(data);
Buffer.from(data, 'base64').toString('binary');