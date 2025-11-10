const nodeCrypto = require("node:crypto");

const currentFips = nodeCrypto.fips;
nodeCrypto.fips = !currentFips;
