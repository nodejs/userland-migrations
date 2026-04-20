const { truncate, open, close } = require('node:fs');

open('file.txt', 'w', (err, fd) => {
	if (err) throw err;
	truncate(fd, 10, (err) => {
		if (err) throw err;
		close(fd, () => { });
	});
});
