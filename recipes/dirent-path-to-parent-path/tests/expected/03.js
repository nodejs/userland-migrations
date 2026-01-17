const fs = require('node:fs');

fs.readdir('/path', { withFileTypes: true }, (err, dirents) => {
  if (err) throw err;

  dirents.forEach(({ name, parentPath, isDirectory }) => {
    console.log(`${name} in ${parentPath}`);
  });
});
