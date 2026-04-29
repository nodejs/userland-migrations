const process = require("node:process");
process.assert(value, "Process assertion");
process.assert.throws(() => { throw new Error(); });
