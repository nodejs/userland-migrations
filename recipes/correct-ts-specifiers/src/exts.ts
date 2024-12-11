/**
 * A map of JavaScript file extensions to the corresponding TypeScript file extension.
 */
export const jsToTSExts = {
	'.cjs': '.cts',
	'.mjs': '.mts',
	'.js': '.ts',
	'.jsx': '.tsx',
} as const;

/**
 * File extensions that potentially need to be corrected
 */
export const suspectExts = {
	'': '.js',
	...jsToTSExts,
} as const;

export type SuspectExt = keyof typeof suspectExts;
export type JSExt = keyof typeof jsToTSExts;
export const jsExts = Object.keys(jsToTSExts) as Array<JSExt>;
export const tsExts = Object.values(jsToTSExts);
export type TSExt = (typeof tsExts)[number];

/**
 * File extensions for TypeScript type declaration files.
 */
export const dExts = ['.d.cts', '.d.ts', '.d.mts'] as const;
export type DExt = (typeof dExts)[number];

/**
 * A master list of file extensions to check.
 */
export const extSets = new Set([jsExts, tsExts, dExts]);
