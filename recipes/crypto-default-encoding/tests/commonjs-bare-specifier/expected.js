const c = require("crypto");

const h = c.createHash("sha1");
h.update("x");

module.exports = h.digest("latin1");
