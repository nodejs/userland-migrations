const crypto = require("node:crypto");

crypto.DEFAULT_ENCODING = "hex";
const hash = crypto.createHash("sha256");
hash.update("some data");
const result = hash.digest();
