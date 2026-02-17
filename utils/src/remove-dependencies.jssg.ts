import type { Transform } from 'codemod:ast-grep';
import type Json from 'codemod:ast-grep/langs/json';
import removeDependencies from './remove-dependencies.ts';

const transform: Transform<Json> = async (root) => {
	return removeDependencies(['chalk', '@types/chalk'], {
		packageJsonPath: root.filename(),
		runInstall: false,
		persistFileWrite: false,
	});
};

export default transform;
