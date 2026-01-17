import removeDependencies from '@nodejs/codemod-utils/remove-dependencies';

/**
 * Remove `tape` and `@types/tape` dependencies from package.json
 */
export default function removeTapeDependencies(): string | null {
	return removeDependencies(['tape', '@types/tape']);
}
