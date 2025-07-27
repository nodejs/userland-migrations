import type { Range } from "@ast-grep/napi";

export function removeLines(sourceCode: string, ranges: Range[]) {
	const lines = sourceCode.split("\n");

	let removeCounter = 0;
	for (const range of ranges) {
		// @ts-ignore - @ast-grep/napi returns start.row but type expects line field
		// TODO: Remove when https://github.com/codemod-com/codemod/pull/1655 is merged
		const start = range.start.row - removeCounter;

		// @ts-ignore - @ast-grep/napi returns start.row but type expects line field
		// TODO: Remove when https://github.com/codemod-com/codemod/pull/1655 is merged
		const end = range.end.row - removeCounter;

		const removedLines = lines.splice(start, end - start + 1);
		removeCounter += removedLines.length;
	}

	return lines.join("\n");
}
