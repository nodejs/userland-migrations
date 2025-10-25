const crypto = require("node:crypto");

console.log("FIPS enabled:", crypto.fips);
crypto.fips = crypto.fips || process.env.FORCE_FIPS;
