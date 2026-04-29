const { readdir } = require('node:fs/promises');

const entries = await readdir('/some/path', { withFileTypes: true });
for (const i = 0; i<entries.length; i++) {
	const tmp = entries[i]
  console.log(tmp.parentPath);
}
