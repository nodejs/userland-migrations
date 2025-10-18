const { existsSync } = require("node:fs");

// Mix of valid and invalid arguments
const valid = existsSync('/valid/path');
const invalid1 = existsSync(String(456));
const invalid2 = existsSync(String(undefined));

