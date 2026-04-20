import fs from 'node:fs';

export default function truncateFile() {
	fs.open('file.txt', 'w', (err, strangeName) => {
		if (err) throw err;
		fs.ftruncate(strangeName, 10, (err) => {
			if (err) throw err;
			fs.close(strangeName, () => { });
		});
	});
}

const accesible = fs.openSync('file.txt', 'w');

fs.ftruncateSync(accesible, 10);

fs.closeSync(accesible);

function foo() {
	truncateFile(unaccessible, 10);
}

function bar() {
	const unaccessible = fs.openSync('file.txt', 'w');
}
