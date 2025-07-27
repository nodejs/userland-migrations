import type { Range } from "@ast-grep/napi";

export function removeLines(sourceCode: string, ranges: Range[]) {
	const lines = sourceCode.split("\n");

	let removeCounter = 0;
	for (const range of ranges) {
		// @ts-ignore - @ast-grep/napi is returning start.row, but the type says the field need to be
		// line
		const start = range.start.row - removeCounter;

		// @ts-ignore - @ast-grep/napi types are outdated
		const end = range.end.row - removeCounter;

		const removedLines = lines.splice(start, end - start + 1);
		removeCounter += removedLines.length;
	}

	return lines.join("\n");
}
