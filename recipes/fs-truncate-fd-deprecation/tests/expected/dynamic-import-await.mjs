const myFS = await import('node:fs');

// fd usage should be transformed
const fd = myFS.openSync('file.txt', 'w');
myFS.ftruncateSync(fd, 10);
myFS.closeSync(fd);

// path usage should not be transformed
myFS.truncate('other.txt', 5, (err) => {
    if (err) throw err;
});
