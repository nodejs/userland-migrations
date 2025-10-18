import { atob, isUtf8 } from "node:buffer";
const data = 'Hello World!';
isUtf8(data);
atob(data);