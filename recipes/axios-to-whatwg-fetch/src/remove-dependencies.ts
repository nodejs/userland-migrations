import type { Codemod } from 'codemod:ast-grep';
import type Json from 'codemod:ast-grep/langs/json';
import removeDependencies from '@nodejs/codemod-utils/remove-dependencies';

/**
 * Remove `axios` and `@types/axios` dependencies from package.json
 */
const transform: Codemod<Json> = async (root) => {
	return removeDependencies(['axios', '@types/axios'], {
		packageJsonPath: root.filename(),
		runInstall: false,
		persistFileWrite: false,
	});
};

export default transform;
