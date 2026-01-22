import fs from 'node:fs';
import path from 'node:path';
import {
	getOrSetStepOutput,
	setStepOutput,
} from '@codemod.com/jssg-types/workflow';
import type { SgRoot } from '@codemod.com/jssg-types/main';
import type JS from '@codemod.com/jssg-types/langs/javascript';

const STEP_ID = 'change-extensions';
const OUTPUT_NAME = 'extension_changes';

export default async function transform(
	root: SgRoot<JS>,
): Promise<string | null> {
	const sourcePath = root.filename();
	if (!sourcePath || sourcePath === 'anonymous') return null;

	if (!sourcePath.endsWith('.cjs') && !sourcePath.endsWith('.mjs')) return null;

	const targetPath = sourcePath.replace(/\.(c|m)js$/i, '.js');
	if (targetPath === sourcePath) return null;

	fs.renameSync(sourcePath, targetPath);

	const from = path.normalize(path.resolve(sourcePath));
	const to = path.normalize(path.resolve(targetPath));

	const existingRaw = getOrSetStepOutput(STEP_ID, OUTPUT_NAME, '[]');
	let mappings: Array<{ from: string; to: string }> = [];

	try {
		const parsed = JSON.parse(existingRaw);
		if (Array.isArray(parsed)) mappings = parsed;
	} catch (error) {
		console.warn(
			'Failed to parse existing extension changes; resetting list',
			error,
		);
	}

	mappings.push({ from, to });
	setStepOutput(OUTPUT_NAME, JSON.stringify(mappings));

	return null;
}
