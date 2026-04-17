import crypto from "node:crypto";

const encrypted = (() => {
	const __dep0106Salt = crypto.randomBytes(16);
	const __dep0106Key = crypto.scryptSync("pw", __dep0106Salt, 32);
	const __dep0106Iv = crypto.randomBytes(16);
	// DEP0106: Persist __dep0106Salt and __dep0106Iv with the ciphertext so it can be decrypted later.
	// DEP0106: Adjust the derived key length (32 bytes) and IV length to match the chosen algorithm.
	return crypto.createCipheriv("aes-256-cbc", __dep0106Key, __dep0106Iv);
})();
