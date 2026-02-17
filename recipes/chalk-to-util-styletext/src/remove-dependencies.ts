import removeDependencies from '@nodejs/codemod-utils/remove-dependencies';

interface RootWithFilename {
	filename(): string;
}

/**
 * Remove chalk and @types/chalk dependencies from package.json
 */
export default async function removeChalkDependencies(
	root: RootWithFilename,
): Promise<string | null> {
	return removeDependencies(['chalk', '@types/chalk'], {
		packageJsonPath: root.filename(),
	});
}
