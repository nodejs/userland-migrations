const buffer = require('node:buffer');
const data = 'SGVsbG8gV29ybGQh'; // "Hello World!" in base64
const decodedData = buffer.atob(data);
console.log(decodedData); // Outputs: Hello World!