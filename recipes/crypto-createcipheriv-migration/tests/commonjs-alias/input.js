const { createCipher: makeCipher } = require("node:crypto");

function wrap(password) {
    return makeCipher("aes-192-cbc", password);
}
