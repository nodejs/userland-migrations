import fs from "node:fs";

const exists = fs.existsSync(String(123));
const exists2 = fs.existsSync(String({ path: '/file' }));

