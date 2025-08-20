import type { Range } from "@codemod.com/jssg-types/main";

export function removeLines(sourceCode: string, ranges: Range[]) {
	const lines = sourceCode.split("\n");

	const uniqueRemoves = new Map<string, Range>();

	for (const range of ranges) {
		const key = `start-line:${range.start.line},end-line:${range.end.line},start-column:${range.start.column},end-column:${range.end.column}`;
		if (!uniqueRemoves.has(key)) {
			uniqueRemoves.set(key, range);
		}
	}

	ranges = Array.from(uniqueRemoves.values());

	let removeCounter = 0;
	for (const range of ranges) {
		const start = range.start.line - removeCounter;

		const end = range.end.line - removeCounter;

		const removedLines = lines.splice(start, end - start + 1);
		removeCounter += removedLines.length;
	}

	return lines.join("\n");
}
