const { DEFAULT_ENCODING, createHash } = require("node:crypto");

const digest = createHash("sha1").update("data").digest(DEFAULT_ENCODING);
