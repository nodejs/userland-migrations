import type { sep } from 'node:path';
/**
 * @example 'foo'
 */
type FSPathSegment = string;
/**
 * @example '/foo/bar.js'
 */
export type FSAbsolutePath = string & `${typeof sep}${FSPathSegment}`;
/**
 * @example 'file:///foo/bar.js'
 */
export type ResolvedSpecifier = `file://${string}`;
/**
 * @example './bar.js'
 */
export type Specifier = URL['pathname'] | ResolvedSpecifier;
/**
 * @example 'foo'
 * @example 'foo/bar'
 */
export type NodeModSpecifier = string | `${string}/${string}`;

export type NodeError = Error &
	Partial<{
		code: string;
		url: FSAbsolutePath;
	}>;
