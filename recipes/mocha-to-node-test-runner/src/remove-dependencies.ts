import removeDependencies from '@nodejs/codemod-utils/remove-dependencies';

/**
 * Remove chalk and @types/chalk dependencies from package.json
 */
export default function removeMochaDependencies(): string | null {
	return removeDependencies(['mocha', '@types/mocha']);
}
