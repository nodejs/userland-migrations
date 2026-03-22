const __filename = '/tmp/file.js';
const __dirname = '/tmp';

function print(__filename, __dirname) {
    return `${__filename}::${__dirname}`;
}

console.log(__filename, __dirname, print('a', 'b'));
