const fs = require("fs");

const a = fs.existsSync(123);
const b = fs.existsSync(null);
const c = fs.existsSync(false);
const d = fs.existsSync([1, 2, 3]);

