const fs = require('node:fs');

const fd = fs.openSync('file.txt', 'w');
try {
	fs.truncateSync(fd, 10);
} finally {
	fs.closeSync(fd);
}
