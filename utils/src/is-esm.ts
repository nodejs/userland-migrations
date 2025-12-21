import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import type JS from '@codemod.com/jssg-types/langs/javascript';
import type { SgRoot } from '@codemod.com/jssg-types/main';

export default function isESM(root: SgRoot<JS>): boolean {
	const rootNode = root.root();
	const usingRequire = rootNode.find({
		rule: {
			kind: 'call_expression',
			has: {
				kind: 'identifier',
				field: 'function',
				regex: 'require',
			},
		},
	});
	const usingImport = rootNode.find({
		rule: {
			kind: 'import_statement',
		},
	});
	const filename = root.filename();

	const isCjsFile = filename.endsWith('.cjs') || filename.endsWith('.cts');
	const isMjsFile = filename.endsWith('.mjs') || filename.endsWith('.mts');

	if (usingImport || isMjsFile) {
		return true;
	}

	if (usingRequire || isCjsFile) {
		return false;
	}

	const packageJsonPath = join(process.cwd(), 'package.json');
	const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
	return packageJson.type === 'module';
}
