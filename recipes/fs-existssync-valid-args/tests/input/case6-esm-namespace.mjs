import fs from "node:fs";

const exists = fs.existsSync(123);
const exists2 = fs.existsSync({ path: '/file' });

