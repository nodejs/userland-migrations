console.log(import.meta.dirname);

function read(__filename) {
    return __filename;
}

{
    const __dirname = 'tmp';
    console.log(__dirname);
}

console.log(import.meta.filename);
