const fs = require("node:fs");

// These should not be modified as they are already valid
const exists1 = fs.existsSync('/path/to/file');
const exists2 = fs.existsSync("another/path");
const exists3 = fs.existsSync(`template/path`);

