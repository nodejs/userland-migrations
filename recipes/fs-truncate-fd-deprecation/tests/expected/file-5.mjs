import fs from 'node:fs';

fs.open('file.txt', 'w', (err, fd) => {
	if (err) throw err;
	fs.ftruncate(fd, 10, (err) => {
		if (err) throw err;
		fs.close(fd, () => { });
	});
});
