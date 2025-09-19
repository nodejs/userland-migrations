import('node:fs').then(fs => {
    // fd usage should be transformed
    const fd = fs.openSync('file.txt', 'w');
    fs.ftruncateSync(fd, 10);
    fs.closeSync(fd);

    // path usage should not be transformed
    fs.truncate('other.txt', 5, (err) => {
        if (err) throw err;
    });
});
