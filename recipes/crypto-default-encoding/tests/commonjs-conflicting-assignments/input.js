const crypto = require("node:crypto");

crypto.DEFAULT_ENCODING = "hex";
crypto.DEFAULT_ENCODING = "base64";

console.log(crypto.DEFAULT_ENCODING);
