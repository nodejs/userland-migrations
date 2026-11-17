import crypto from "node:crypto";

const hmac = crypto.createHmac("sha256", "secret");
hmac.update("data");
const buf = hmac.digest();
