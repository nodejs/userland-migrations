import { join } from 'node:path';
import { readFileSync, accessSync, constants } from 'node:fs';
import type JS from '@codemod.com/jssg-types/langs/javascript';
import type { SgNode } from '@codemod.com/jssg-types/main';

/**
 * This api didn't exist on JSSG (behind the scenesn it use llrt)
 *
 * @param path name of the file to check for existence
 */
const existsSync = (path: string) => {
	try {
		accessSync(path, constants.F_OK);
		return true;
	} catch {
		return false;
	}
}

export default function isESM(rootNode: SgNode<JS>): boolean {
	const filename = rootNode.getRoot().filename();

	if (filename.endsWith('.mjs') || filename.endsWith('.mts')) return true;

	if (filename.endsWith('.cjs') || filename.endsWith('.cts')) return false;


	const usingImport = rootNode.find({
		rule: {
			kind: 'import_statement',
		},
	});
	if (usingImport) return true;

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
	if (usingRequire) return false;

	const packageJsonPath = join(process.cwd(), 'package.json');
	if (!existsSync(packageJsonPath)) return false;
	try {
		const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
		return packageJson.type === 'module';
	} catch {
		return false;
	}
}
