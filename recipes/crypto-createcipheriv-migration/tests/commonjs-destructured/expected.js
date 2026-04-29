const { createCipheriv: createCipher, randomBytes, scryptSync } = require("node:crypto");

const cipher = (() => {
	const __dep0106Salt = randomBytes(16);
	const __dep0106Key = scryptSync("password123", __dep0106Salt, 32);
	const __dep0106Iv = randomBytes(16);
	// DEP0106: Persist __dep0106Salt and __dep0106Iv with the ciphertext so it can be decrypted later.
	// DEP0106: Adjust the derived key length (32 bytes) and IV length to match the chosen algorithm.
	return createCipher("aes-128-cbc", __dep0106Key, __dep0106Iv);
})();
