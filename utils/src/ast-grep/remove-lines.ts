import type { Range } from "@ast-grep/napi";

export function removeLines(sourceCode: string, ranges: Range[]) {
	const lines = sourceCode.split("\n");

	let removeCounter = 0;
	for (const range of ranges) {
		const start = range.start.line - removeCounter;

		const end = range.end.line - removeCounter;

		const removedLines = lines.splice(start, end - start + 1);
		removeCounter += removedLines.length;
	}

	return lines.join("\n");
}
