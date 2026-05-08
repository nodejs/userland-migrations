const data = 'SGVsbG8gV29ybGQh'; // "Hello World!" in base64
const decodedData = Buffer.from(data, 'base64').toString('binary');
console.log(decodedData); // Outputs: Hello World!