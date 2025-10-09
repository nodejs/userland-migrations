const fs = require("node:fs");

function checkFile(path) {
  if (typeof path !== 'string' && !Buffer.isBuffer(path) && !(path instanceof URL)) {
    path = String(path);
  }
  return fs.existsSync(path);
}

