import type { Edit, SgNode, SgRoot } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';

type BindingKind = 'async' | 'sync';

type Binding = {
	kind: BindingKind;
	name: string;
};

type ImportReplacement = {
	usesGlobSync: boolean;
	usesRm: boolean;
	usesRmPromise: boolean;
	usesRmSync: boolean;
};

const RIMRAF_SOURCE_REGEX = '^rimraf(-v[345])?$';

/**
 * Escapes a binding name so it can be used safely in an ast-grep regex.
 */
const escapeRegex = (value: string) =>
	value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getLineEnding = (source: string) =>
	source.includes('\r\n') ? '\r\n' : '\n';

/**
 * Returns the top-level call arguments.
 */
const getCallArguments = (call: SgNode<Js>): string[] => {
	const args = call.field('arguments');
	if (!args) return [];

	return args
		.children()
		.filter((child) => ![',', '(', ')'].includes(child.kind()))
		.map((child) => child.text());
};

/**
 * Returns whether an argument is an object literal options bag.
 */
const isObjectLiteral = (value: string | undefined) =>
	value?.trim().startsWith('{') ?? false;

/**
 * Returns whether a literal path contains glob syntax.
 */
const isGlobLiteral = (value: string | undefined) => {
	if (!value) return false;
	const trimmed = value.trim();
	if (!/^["'`]/.test(trimmed)) return false;
	return /[*?{}[\]]/.test(trimmed.slice(1, -1));
};

/**
 * Extracts rimraf and rimrafSync bindings from named imports.
 */
const parseNamedBindings = (source: string): Binding[] => {
	const bindings: Binding[] = [];
	const namedMatch = source.match(/{([^}]+)}/);
	if (!namedMatch) return bindings;

	for (const rawSpecifier of namedMatch[1].split(',')) {
		const specifier = rawSpecifier.trim();
		if (!specifier) continue;
		const [importedName, alias] = specifier.split(/\s+as\s+/);
		const localName = (alias || importedName).trim();

		if (importedName.trim() === 'rimraf') {
			bindings.push({ kind: 'async', name: localName });
		}

		if (importedName.trim() === 'rimrafSync') {
			bindings.push({ kind: 'sync', name: localName });
		}
	}

	return bindings;
};

/**
 * Extracts default and named rimraf bindings from an import statement.
 */
const parseImportBindings = (source: string): Binding[] => {
	const bindings = parseNamedBindings(source);
	const defaultMatch = source.match(/^import\s+([^,{]+?)(?:\s*,|\s+from\s+)/);
	const defaultName = defaultMatch?.[1]?.trim();

	if (defaultName) {
		bindings.push({ kind: 'async', name: defaultName });
	}

	return bindings;
};

/**
 * Builds the node:fs imports required by the transformed calls.
 */
const buildImportReplacement = (
	replacement: ImportReplacement,
	lineEnding: string,
) => {
	const fsImports: string[] = [];
	if (replacement.usesGlobSync) fsImports.push('globSync');
	if (replacement.usesRm) fsImports.push('rm');
	if (replacement.usesRmSync) fsImports.push('rmSync');

	const lines: string[] = [];
	if (fsImports.length) {
		lines.push(`import { ${fsImports.join(', ')} } from "node:fs";`);
	}
	if (replacement.usesRmPromise) {
		lines.push('import { rm as rmPromise } from "node:fs/promises";');
	}

	return lines.join(lineEnding);
};

/**
 * Builds the recursive rm options that match rimraf's common force behavior.
 */
const buildRmOptions = () => '{ recursive: true, force: true }';

/**
 * Converts direct rimraf calls to native fs.rm APIs.
 */
export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const lineEnding = getLineEnding(rootNode.text());
	const edits: Edit[] = [];

	const rimrafImports = rootNode.findAll({
		rule: {
			kind: 'import_statement',
			has: {
				field: 'source',
				kind: 'string',
				has: {
					kind: 'string_fragment',
					regex: RIMRAF_SOURCE_REGEX,
				},
			},
		},
	});

	const bindings: Binding[] = [];
	for (const importNode of rimrafImports) {
		bindings.push(...parseImportBindings(importNode.text()));
	}

	if (!bindings.length) return null;

	const replacement: ImportReplacement = {
		usesGlobSync: false,
		usesRm: false,
		usesRmPromise: false,
		usesRmSync: false,
	};

	for (const binding of bindings) {
		const calls = rootNode.findAll({
			rule: {
				kind: 'call_expression',
				has: {
					field: 'function',
					kind: 'identifier',
					regex: `^${escapeRegex(binding.name)}$`,
				},
			},
		});

		for (const call of calls) {
			const args = getCallArguments(call);
			const pathArg = args[0];
			if (!pathArg) continue;

			if (binding.kind === 'sync') {
				replacement.usesRmSync = true;

				if (isGlobLiteral(pathArg)) {
					replacement.usesGlobSync = true;
					const loopText = [
						`for (const filePath of globSync(${pathArg})) {`,
						`\trmSync(filePath, ${buildRmOptions()});`,
						'}',
					].join(lineEnding);
					const parent = call.parent();
					edits.push(
						parent?.kind() === 'expression_statement'
							? parent.replace(loopText)
							: call.replace(loopText),
					);
					continue;
				}

				edits.push(call.replace(`rmSync(${pathArg}, ${buildRmOptions()})`));
				continue;
			}

			const callbackArg =
				args.length >= 2 && !isObjectLiteral(args.at(-1))
					? args.at(-1)
					: undefined;

			if (callbackArg) {
				replacement.usesRm = true;
				edits.push(
					call.replace(`rm(${pathArg}, ${buildRmOptions()}, ${callbackArg})`),
				);
				continue;
			}

			replacement.usesRmPromise = true;
			edits.push(call.replace(`rmPromise(${pathArg}, ${buildRmOptions()})`));
		}
	}

	const hasCallEdits = edits.length > 0;
	if (!hasCallEdits) {
		return null;
	}

	const importReplacement = buildImportReplacement(replacement, lineEnding);
	for (const [index, importNode] of rimrafImports.entries()) {
		if (index === 0) {
			edits.push(importNode.replace(importReplacement));
		} else {
			edits.push(importNode.replace(''));
		}
	}

	return rootNode.commitEdits(edits);
}
