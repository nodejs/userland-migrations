const crypto = require("node:crypto");

const algorithm = "aes-256-cbc";
const password = "s3cret";
const cipher = crypto.createCipher(algorithm, password);
