const crypto = require("node:crypto");

const hash = crypto.createHash("sha256");
hash.update("some data");

module.exports = hash.digest("hex");
