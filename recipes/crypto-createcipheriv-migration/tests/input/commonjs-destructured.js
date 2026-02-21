const { createCipher } = require("node:crypto");

const cipher = createCipher("aes-128-cbc", "password123");
