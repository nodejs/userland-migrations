import type { SgNode } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';

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

export function findParentStatement(node: SgNode<Js>): SgNode<Js> | null {
	for (const ancestor of node.ancestors()) {
		if (ancestor.kind() === 'expression_statement') {
			return ancestor;
		}
	}
	return null;
}

export function isSafeResourceTarget(node: SgNode<Js>): boolean {
	return node.is('identifier') || node.is('member_expression');
}

function gcd(a: number, b: number): number {
	let x = Math.abs(a);
	let y = Math.abs(b);
	while (y !== 0) {
		const temp = y;
		y = x % y;
		x = temp;
	}
	return x;
}
