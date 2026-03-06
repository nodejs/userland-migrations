import type { Transform } from '@codemod.com/jssg-types/main';
import type Json from '@codemod.com/jssg-types/langs/json';
import removeDependencies from '@nodejs/codemod-utils/remove-dependencies';

const transform: Transform<Json> = async (root) => {
	return removeDependencies(['chalk', '@types/chalk'], {
		packageJsonPath: root.filename(),
		runInstall: false,
		persistFileWrite: false,
	});
};

export default transform;
