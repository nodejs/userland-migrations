const fs = require('node:fs');

fs.readdir('/path', { withFileTypes: true }, (err, dirents) => {
  if (err) throw err;

  dirents.forEach(({ name, path, isDirectory }) => {
    console.log(`${name} in ${path}`);
  });
});
