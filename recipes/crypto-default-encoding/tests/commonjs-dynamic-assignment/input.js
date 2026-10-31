const crypto = require("node:crypto");

crypto.DEFAULT_ENCODING = process.env.CRYPTO_ENCODING;

const encoding = crypto.DEFAULT_ENCODING;
