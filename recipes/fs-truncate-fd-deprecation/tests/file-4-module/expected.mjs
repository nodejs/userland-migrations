import { ftruncate, open, close } from 'node:fs';

open('file.txt', 'w', (err, fd) => {
	if (err) throw err;
	ftruncate(fd, 10, (err) => {
		if (err) throw err;
		close(fd, () => { });
	});
});
