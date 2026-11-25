import crypto from "node:crypto";

// DEP0091: `crypto.DEFAULT_ENCODING` was removed in Node.js v20; its value is inlined here.
if ("buffer" === "hex") {
	console.log("hex");
}
