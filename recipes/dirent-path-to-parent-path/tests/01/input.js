const { readdir } = require('node:fs/promises');

const entries = await readdir('/some/path', { withFileTypes: true });
for (const dirent of entries) {
  console.log(dirent.path);
}
