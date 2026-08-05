/**
 * The subset of conventional commit prefixes used in this project.
 */
export const SUPPORTED_PREFIXES = [
	'doc',
	'dep',
	'fix',
	'feat',
	'setup',
	'test',
] as const;

export const SCOPE_RGX = new RegExp(`^(${SUPPORTED_PREFIXES.join('|')})\\([\\w\\-\\d]*\\)\\: `);
