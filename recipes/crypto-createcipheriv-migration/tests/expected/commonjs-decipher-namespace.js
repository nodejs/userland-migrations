const crypto = require("crypto");

const decipher = (() => {
	// DEP0106: Replace the placeholders below with the salt and IV that were stored with the ciphertext.
	const __dep0106Salt = /* TODO: stored salt Buffer */ Buffer.alloc(16);
	const __dep0106Iv = /* TODO: stored IV Buffer */ Buffer.alloc(16);
	const __dep0106Key = crypto.scryptSync("pw", __dep0106Salt, 32);
	// DEP0106: Ensure __dep0106Salt and __dep0106Iv match the values used during encryption.
	return crypto.createDecipheriv("aes-256-cbc", __dep0106Key, __dep0106Iv);
})();
