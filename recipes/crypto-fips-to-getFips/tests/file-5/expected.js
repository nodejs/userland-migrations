const nodeCrypto = require("node:crypto");

const currentFips = nodeCrypto.getFips();
nodeCrypto.setFips(!currentFips);
