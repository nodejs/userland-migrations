const crypto = require("node:crypto");

const hmac = crypto.createHmac("sha256", "secret");
hmac.update("payload");

module.exports = {
	signature: hmac.digest("base64"),
	inline: crypto.createHmac("sha256", "secret").update("payload").digest("base64"),
};
