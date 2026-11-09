import crypto from "node:crypto";

export function encodingName(): string {
	// DEP0091: `crypto.DEFAULT_ENCODING` was removed in Node.js v20; its value is inlined here.
	const encoding: string = "buffer";

	return encoding;
}
