const c = require("crypto");

c.DEFAULT_ENCODING = "latin1";

const h = c.createHash("sha1");
h.update("x");

module.exports = h.digest();
