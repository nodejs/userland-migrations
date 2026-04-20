const fs = require('node:fs');

function processDirectory(path) {
  const entries = fs.readdirSync(path, { withFileTypes: true });

  return entries.map(dirent => ({
    name: dirent.name,
    directory: dirent.parentPath,
    type: dirent.isDirectory() ? 'dir' : 'file',
    fullPath: `${dirent.parentPath}/${dirent.name}`
  }));
}
