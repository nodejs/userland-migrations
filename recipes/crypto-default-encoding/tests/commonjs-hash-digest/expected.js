const crypto = require("node:crypto");

const hash = crypto.createHash("sha256");
hash.update("some data");
const result = hash.digest("hex");
