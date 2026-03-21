const info = {
    filename: import.meta.filename,
    dirname: import.meta.dirname,
    isMain: import.meta.main,
    resolved: import.meta.resolve('./foo.js'),
};

console.log(info, import.meta.main);
