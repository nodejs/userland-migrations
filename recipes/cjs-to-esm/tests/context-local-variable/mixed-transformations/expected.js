if (import.meta.main) {
    boot();
}

const resolved = import.meta.resolve('./foo.js', { paths: [__dirname] });
const filePath = `${import.meta.filename}`;

console.log(import.meta.main, resolved, filePath);
