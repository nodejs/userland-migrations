import type { FSAbsolutePath, Specifier } from './types.ts';
import { fexists } from './fexists.ts';
import { logger } from './logger.ts';
import { isDir } from './is-dir.ts';
import { isIgnorableSpecifier } from './is-ignorable-specifier.ts';
import { replaceJSExtWithTSExt } from './replace-js-ext-with-ts-ext.ts';

/**
 * Determine what, if anything, to replace the existing specifier.
 * @param parentPath The module containing the provided specifier.
 * @param specifier The specifier to potentially correct.
 */
export const mapImports = async (
	parentPath: FSAbsolutePath,
	specifier: Specifier,
): Promise<{
	isType?: boolean;
	replacement?: string;
}> => {
	if (isIgnorableSpecifier(parentPath, specifier)) return {};

	const { isType, replacement } = await replaceJSExtWithTSExt(parentPath, specifier);

	if (replacement) {
		if ((await fexists(parentPath, specifier)) && !(await isDir(parentPath, specifier))) {
			logger(
				parentPath,
				'warn',
				[
					`Import specifier "${specifier}" contains a JS extension AND a file`,
					'with the corresponding TS extension exists. Cannot disambiguate (skipping).',
				].join(' '),
			);

			return { isType, replacement: specifier };
		}

		return { isType, replacement };
	}

	if (!(await fexists(parentPath, specifier)))
		logger(parentPath, 'error', `No matching file found for "${specifier}"`);

	return {};
};
