const crypto = require("node:crypto");

const cipher = crypto.createCipher("aes-256-cbc", "pw", { authTagLength: 16 });
