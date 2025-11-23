const { truncate, ftruncateSync, open, openSync, close, closeSync } = require('node:fs');

// This should be replaced (file descriptor)
const fd = openSync('file.txt', 'w');
ftruncateSync(fd, 10);
closeSync(fd);

// This should NOT be replaced (file path)
truncate('other.txt', 5, (err) => {
	if (err) throw err;
});
