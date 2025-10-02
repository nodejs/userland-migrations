const data = 'Hello World!';
const encodedData = Buffer.from(data, 'binary').toString('base64');
console.log(encodedData); // Outputs: SGVsbG8gV29ybGQh