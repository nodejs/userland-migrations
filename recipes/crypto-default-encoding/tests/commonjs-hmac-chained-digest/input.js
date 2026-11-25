const crypto = require("node:crypto");

crypto.DEFAULT_ENCODING = "base64";

const hmac = crypto.createHmac("sha256", "secret");
hmac.update("payload");

module.exports = {
	signature: hmac.digest(),
	inline: crypto.createHmac("sha256", "secret").update("payload").digest(),
};
