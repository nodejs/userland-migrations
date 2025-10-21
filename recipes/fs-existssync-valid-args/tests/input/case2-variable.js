const fs = require("node:fs");

function checkFile(path) {
  return fs.existsSync(path);
}

