import { gcd } from '../math.ts';

export function detectIndentUnit(source: string): string {
	let tabIndent = '';
	const spaceIndents: number[] = [];
	const lines = source.split(/\r?\n/);

	for (const line of lines) {
		const match = line.match(/^(\s+)/);
		if (!match) continue;
		const leading = match[1];
		if (leading.includes('\t')) {
			tabIndent = '\t';
			break;
		}
		spaceIndents.push(leading.length);
	}

	if (tabIndent) return tabIndent;
	if (!spaceIndents.length) return '\t';

	const unit = spaceIndents.reduce((acc, len) => gcd(acc, len));
	return ' '.repeat(unit || spaceIndents[0]);
}

export function getLineIndent(source: string, index: number): string {
	let cursor = index;
	while (
		cursor > 0 &&
		source[cursor - 1] !== '\n' &&
		source[cursor - 1] !== '\r'
	) {
		cursor--;
	}

	let indent = '';
	while (cursor < source.length) {
		const char = source[cursor];
		if (char === ' ' || char === '\t') {
			indent += char;
			cursor++;
			continue;
		}
		break;
	}

	return indent;
}
