const crypto = require("node:crypto");

const encoding = crypto.DEFAULT_ENCODING || "binary";
const hash = crypto.createHash("md5").update("data").digest(encoding);
