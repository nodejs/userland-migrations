const info = {
    filename: __filename,
    dirname: __dirname,
    isMain: require.main === module,
    resolved: require.resolve('./foo.js'),
};

console.log(info, require.main);
