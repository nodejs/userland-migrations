const fs = require("fs");

function readConfig(path) {
  process.assert(fs.existsSync(path), "Config file must exist");
  const data = fs.readFileSync(path, "utf8");
  process.assert.ok(data.length > 0, "Config file cannot be empty");
  return JSON.parse(data);
}
