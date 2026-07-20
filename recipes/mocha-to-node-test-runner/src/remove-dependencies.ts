import type { Codemod } from 'codemod:ast-grep';
import type Json from 'codemod:ast-grep/langs/json';
import removeDependencies from '@nodejs/codemod-utils/remove-dependencies';

const transform: Codemod<Json> = async (root) => {
	return removeDependencies(['mocha', '@types/mocha'], {
		packageJsonPath: root.filename(),
		runInstall: false,
		persistFileWrite: false,
	});
};

export default transform;
