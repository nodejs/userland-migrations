const fs = require('node:fs');

fs.readdir('/path', { withFileTypes: true }, function(err, dirents) {
  if (err) throw err;

  dirents.forEach(({ name, path, isDirectory }) => {
    console.log(`${name} in ${path}`);
  });
});
