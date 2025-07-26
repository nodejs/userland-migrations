import fs from 'node:fs';

fs.open('file.txt', 'w', (err, fd) => {
	if (err) throw err;
	fs.truncate(fd, 10, (err) => {
		if (err) throw err;
		fs.close(fd, () => { });
	});
});
