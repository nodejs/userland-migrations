const buffer = require("node:buffer");
const data = 'Hello World!';
const encodedData = buffer.btoa(data);
console.log(encodedData); // Outputs: SGVsbG8gV29ybGQh