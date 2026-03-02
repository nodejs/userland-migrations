import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import type JS from '@codemod.com/jssg-types/langs/javascript';
import type { SgRoot } from '@codemod.com/jssg-types/main';

export default function isESM(root: SgRoot<JS>): boolean {
	const filename = root.filename();

	const isCjsFile = filename.endsWith('.cjs') || filename.endsWith('.cts');
	const isMjsFile = filename.endsWith('.mjs') || filename.endsWith('.mts');
	if (isMjsFile) {
		return true;
	}
	if (isCjsFile) {
		return false;
	}

	const rootNode = root.root();
	const usingImport = rootNode.find({
		rule: {
			kind: 'import_statement',
		},
	});
	if (usingImport) {
		return true;
	}

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
	if (usingRequire) {
		return false;
	}

	const packageJsonPath = join(process.cwd(), 'package.json');
	const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
	return packageJson.type === 'module';
}
