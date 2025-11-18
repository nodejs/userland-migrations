import removeDependencies from '@nodejs/codemod-utils/remove-dependencies';

/**
 * Remove chalk and @types/chalk dependencies from package.json
 */
export default function removeChalkDependencies(): string | null {
	return removeDependencies(['chalk', '@types/chalk']);
}
