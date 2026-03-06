import type { Transform } from '@codemod.com/jssg-types/main';
import type Json from '@codemod.com/jssg-types/langs/json';
import removeDependencies from '@nodejs/codemod-utils/remove-dependencies';

/**
 * Remove `axios` and `@types/axios` dependencies from package.json
 */
const transform: Transform<Json> = async (root) => {
	return removeDependencies(['axios', '@types/axios'], {
		packageJsonPath: root.filename(),
		runInstall: false,
		persistFileWrite: false,
	});
};

export default transform;
