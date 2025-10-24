const crypto = require("node:crypto");

console.log("FIPS enabled:", crypto.getFips());
crypto.setFips(crypto.getFips() || process.env.FORCE_FIPS);
