if (require.main === module) {
    boot();
}

const resolved = require.resolve('./foo.js', { paths: [__dirname] });
const filePath = `${__filename}`;

console.log(require.main, resolved, filePath);
