const { existsSync } = require("node:fs");

// Mix of valid and invalid arguments
const valid = existsSync('/valid/path');
const invalid1 = existsSync(456);
const invalid2 = existsSync(undefined);

