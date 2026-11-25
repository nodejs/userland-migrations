import crypto from "node:crypto";

export function encodingName(): string {
	const encoding: string = crypto.DEFAULT_ENCODING;

	return encoding;
}
