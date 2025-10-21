const fs = require("node:fs");

// These should NOT be modified - already wrapped with String()
const exists1 = fs.existsSync(String(123));
const exists2 = fs.existsSync(String(null));

// These should NOT be modified - already using Buffer
const exists3 = fs.existsSync(Buffer.from('/path'));

// These should NOT be modified - already using new URL
const exists4 = fs.existsSync(new URL('file:///path'));

