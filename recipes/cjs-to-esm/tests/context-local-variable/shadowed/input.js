console.log(__dirname);

function read(__filename) {
    return __filename;
}

{
    const __dirname = 'tmp';
    console.log(__dirname);
}

console.log(__filename);
