import type { Range } from '@codemod.com/jssg-types/main';

/**
 * Safely remove multiple line ranges from a source file.
 * Handles duplicate and overlapping ranges by normalizing and applying
 * removals in order.
 *
 * @param sourceCode - The original source code as a single string
 * @param ranges - An array of ranges to remove (1-based line numbers)
 * @returns The modified source code with the specified ranges removed
 */
export function removeLines(sourceCode: string, ranges: Range[]) {
	const lines = sourceCode.split('\n');

	// Remove duplicate ranges to prevent attempting to delete the same range multiple times,
	// which could cause inconsistent behavior
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

	return lines.join('\n');
}
