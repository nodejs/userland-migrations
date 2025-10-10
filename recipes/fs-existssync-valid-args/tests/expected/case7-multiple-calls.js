const fs = require("fs");

const a = fs.existsSync(String(123));
const b = fs.existsSync(String(null || ''));
const c = fs.existsSync(String(false));
const d = fs.existsSync(String([1, 2, 3]));

