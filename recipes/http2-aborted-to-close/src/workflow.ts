import type { Edit, Rule, SgNode, SgRoot } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';
import { getModuleDependencies } from '@nodejs/codemod-utils/ast-grep/module-dependencies';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import {
	detectIndentUnit,
	getLineIndent,
} from '@nodejs/codemod-utils/ast-grep/indent';

/*
 * DEP0207: the `'aborted'` event and `.aborted` property of `Http2Stream`.
 *
 * This codemod applies ONE migration strategy: "run this handler when the
 * writable side did not finish before the stream closed". It rewrites
 *
 *   stream.on('aborted', () => { body })
 *
 * to
 *
 *   stream.on('close', () => { if (stream.writableFinished) return; body })
 *
 * `'close'` and `writableFinished` are not an exact synonym of `'aborted'`
 * (timing and the cases that fire the handler differ), so the scope is narrow:
 *
 * - Only streams it can resolve locally: the first parameter of a
 *   `'stream'` listener on a server from `createServer()` /
 *   `createSecureServer()`, and the result of `session.request()` on a
 *   session from `connect()`.
 * - Only inline listeners with no parameters, registered as a statement.
 * - A stream whose `'aborted'` listeners are removed, counted or listed is
 *   left alone, because the rewrite would change that code's result.
 * - The compatibility API (`createServer((req, res) => ...)`) is not touched:
 *   request and response are different sides of the exchange.
 * - `.aborted` property reads are only reported, never rewritten.
 *
 * Everything it skips is reported with `console.warn` for manual review.
 */

/** Methods that register a listener. */
const LISTENER_METHODS =
	'^(on|once|addListener|prependListener|prependOnceListener)$';

/** Methods whose result changes if an `'aborted'` listener is moved. */
const LISTENER_QUERY_METHODS =
	'^(off|removeListener|removeAllListeners|listeners|rawListeners|listenerCount)$';

const INLINE_FUNCTION: Rule<Js> = {
	any: [{ kind: 'arrow_function' }, { kind: 'function_expression' }],
};

/** A string literal whose content is exactly `value`. */
const stringLiteral = (value: string): Rule<Js> => ({
	kind: 'string',
	has: { kind: 'string_fragment', regex: `^${value}$` },
});

type Factory = { path: string; declaration: SgNode<Js> };
type StreamBinding = { name: string; declaration: SgNode<Js> };

export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const source = rootNode.text();
	const edits: Edit[] = [];

	const http2Statements = getModuleDependencies(root, 'http2');
	if (!http2Statements.length) return null;

	const serverFactories: Factory[] = [];
	const connectCallees: Factory[] = [];
	for (const stmt of http2Statements) {
		// Side-effect imports have no binding to resolve.
		if (
			stmt.is('import_statement') &&
			!stmt.find({ rule: { kind: 'import_clause' } })
		)
			continue;
		for (const path of ['$.createServer', '$.createSecureServer']) {
			const resolved = resolveBindingPath(stmt, path);
			if (resolved) addFactory(serverFactories, stmt, resolved);
		}
		const connect = resolveBindingPath(stmt, '$.connect');
		if (connect) addFactory(connectCallees, stmt, connect);
	}

	const streams: StreamBinding[] = [
		...findServerStreams(rootNode, serverFactories),
		...findClientStreams(rootNode, connectCallees),
	];

	const warn = (message: string, node: SgNode<Js>) => {
		const { line, column } = node.range().start;
		console.warn(
			`[Codemod] DEP0207: ${message} (at ${root.filename()}:${line + 1}:${column + 1})`,
		);
	};

	const indentUnit = detectIndentUnit(source);

	for (const { name, declaration } of streams) {
		const belongsToStream = (node: SgNode<Js>) =>
			sameBinding(node.getMatch('STREAM'), declaration);
		const listeners = rootNode
			.findAll({
				rule: { pattern: '$STREAM.$METHOD($EVENT, $LISTENER)' },
				constraints: {
					METHOD: { regex: LISTENER_METHODS },
					EVENT: stringLiteral('aborted'),
				},
			})
			.filter(belongsToStream);

		const hasListenerQuery = rootNode
			.findAll({
				rule: {
					pattern: '$STREAM.$METHOD($$$ARGS)',
					// The event is the first argument; `removeAllListeners` may have no other.
					has: {
						field: 'arguments',
						has: { nthChild: 1, ...stringLiteral('aborted') },
					},
				},
				constraints: { METHOD: { regex: LISTENER_QUERY_METHODS } },
			})
			.some(belongsToStream);

		for (const call of listeners) {
			if (hasListenerQuery) {
				warn(
					`'aborted' listeners of \`${name}\` are removed, counted or listed elsewhere; review this listener manually`,
					call,
				);
				continue;
			}

			const listener = call.getMatch('LISTENER');
			if (
				!listener?.matches({ rule: INLINE_FUNCTION }) ||
				parameterNodes(listener).length !== 0 ||
				!call.parent()?.is('expression_statement')
			) {
				warn(
					`only inline 'aborted' listeners with no parameters are migrated; review this listener on \`${name}\` manually`,
					call,
				);
				continue;
			}

			const body = listener.field('body');
			const fragment = call
				.getMatch('EVENT')
				?.find({ rule: { kind: 'string_fragment' } });
			if (!body || !fragment) continue;

			if (shadowsGuard(listener, name)) {
				warn(
					`this listener shadows \`${name}\`; review its writableFinished check manually`,
					call,
				);
				continue;
			}
			const returnTypeEdit = widenReturnType(listener);
			if (returnTypeEdit === false) {
				warn(
					'this listener has a return type that needs manual review before adding an early return',
					call,
				);
				continue;
			}
			if (returnTypeEdit) edits.push(returnTypeEdit);
			edits.push(fragment.replace('close'));

			const baseIndent = getLineIndent(source, call.range().start.index);
			edits.push(...guardBody(body, name, baseIndent, indentUnit));
		}

		for (const read of rootNode
			.findAll({
				rule: { pattern: '$STREAM.aborted' },
			})
			.filter(belongsToStream)) {
			warn(
				`\`${name}.aborted\` is deprecated and was not rewritten; choose \`destroyed\`, \`writableFinished\` or \`readableEnded\` for what this code means`,
				read,
			);
		}
	}

	return rootNode.commitEdits(edits);
}

/**
 * The first parameter of each `'stream'` listener registered on a server
 * created by one of `factories`, scoped to that listener's body.
 */
function findServerStreams(
	rootNode: SgNode<Js>,
	factories: Factory[],
): StreamBinding[] {
	const servers = declaredBindings(rootNode, (value) =>
		isFactoryCall(value, factories),
	);

	const streams: StreamBinding[] = [];
	for (const call of rootNode.findAll({
		rule: { pattern: '$SERVER.$METHOD($EVENT, $LISTENER)' },
		constraints: {
			METHOD: { regex: LISTENER_METHODS },
			EVENT: stringLiteral('stream'),
			LISTENER: INLINE_FUNCTION,
		},
	})) {
		const server = call.getMatch('SERVER');
		if (
			!isFactoryCall(server, factories) &&
			!servers.some((binding) => sameBinding(server, binding.declaration))
		)
			continue;
		const listener = call.getMatch('LISTENER');
		const declaration = listener && firstParameter(listener);
		if (declaration) streams.push({ name: declaration.text(), declaration });
	}
	return streams;
}

/**
 * Variables that hold `session.request(...)`, where `session` holds the
 * result of one of `connectCallees`.
 */
function findClientStreams(
	rootNode: SgNode<Js>,
	connectCallees: Factory[],
): StreamBinding[] {
	const sessions = declaredBindings(rootNode, (value) =>
		isFactoryCall(value, connectCallees),
	);
	return declaredBindings(rootNode, (value) => {
		const request = value.find({
			rule: { pattern: '$SESSION.request($$$ARGS)' },
		});
		return (
			request?.id() === value.id() &&
			sessions.some((binding) =>
				sameBinding(request.getMatch('SESSION'), binding.declaration),
			)
		);
	});
}

/** Keep declaration identity instead of collecting names across unrelated scopes. */
function declaredBindings(
	rootNode: SgNode<Js>,
	matchesValue: (node: SgNode<Js>) => boolean,
): StreamBinding[] {
	const bindings: StreamBinding[] = [];
	for (const declarator of rootNode.findAll({
		rule: {
			kind: 'variable_declarator',
			has: { field: 'name', kind: 'identifier' },
		},
	})) {
		const declaration = declarator.field('name');
		const value = declarator.field('value');
		if (declaration && value && matchesValue(value))
			bindings.push({ name: declaration.text(), declaration });
	}
	return bindings;
}

function sameBinding(
	reference: SgNode<Js> | null,
	declaration: SgNode<Js>,
): boolean {
	if (!reference?.is('identifier') || reference.text() !== declaration.text())
		return false;
	const actual = reference.definition({ resolveExternal: false });
	// Definitions may point at the identifier, a typed parameter, or an import specifier.
	return (
		!!actual &&
		actual.root.filename() === declaration.getRoot().filename() &&
		actual.node.range().start.index <= declaration.range().start.index &&
		actual.node.range().end.index >= declaration.range().end.index
	);
}

function addFactory(factories: Factory[], statement: SgNode<Js>, path: string) {
	const name = path.split('.')[0];
	const declaration = statement
		.findAll({
			rule: {
				any: [
					{ kind: 'identifier' },
					{ kind: 'shorthand_property_identifier_pattern' },
				],
			},
		})
		.find(
			(node) =>
				node.text() === name &&
				// In `import { createServer as createServer }`, select the local alias.
				(!node.parent()?.is('import_specifier') ||
					!node.parent()?.field('alias') ||
					node.parent()?.field('alias')?.id() === node.id()) &&
				node.definition({ resolveExternal: false }),
		);
	if (declaration) factories.push({ path, declaration });
}

function isFactoryCall(node: SgNode<Js> | null, factories: Factory[]): boolean {
	if (!node?.is('call_expression')) return false;
	const callee = node.field('function');
	let reference: SgNode<Js> | null = callee;
	while (reference?.is('member_expression'))
		reference = reference.field('object');
	return factories.some(
		(factory) =>
			node.matches({ rule: { pattern: `${factory.path}($$$ARGS)` } }) &&
			sameBinding(reference, factory.declaration),
	);
}

function parameterNodes(fn: SgNode<Js>): SgNode<Js>[] {
	// `x => ...` has a single `parameter` field instead of `parameters`.
	const single = fn.field('parameter');
	if (single) return [single];
	return (
		fn
			.field('parameters')
			?.children()
			.filter((child) => child.isNamed() && !child.is('comment')) ?? []
	);
}

function firstParameter(fn: SgNode<Js>): SgNode<Js> | undefined {
	let param = parameterNodes(fn)[0];
	// TypeScript wraps parameters: `required_parameter` > `pattern`.
	if (param?.is('required_parameter')) {
		param = param.field('pattern') ?? param;
	}
	return param?.is('identifier') ? param : undefined;
}

/** The inserted reference must still refer to the stream inside the callback. */
function shadowsGuard(listener: SgNode<Js>, name: string): boolean {
	if (listener.field('name')?.text() === name) return true;
	const body = listener.field('body');
	const functionScope: Rule<Js> = {
		any: [
			INLINE_FUNCTION,
			{ kind: 'function_declaration' },
			{ kind: 'generator_function' },
			{ kind: 'generator_function_declaration' },
			{ kind: 'method_definition' },
		],
	};
	return body
		.findAll({
			rule: {
				any: [
					{ kind: 'variable_declarator' },
					{ kind: 'function_declaration' },
					{ kind: 'generator_function_declaration' },
					{ kind: 'class_declaration' },
				],
			},
		})
		.some((declaration) => {
			const pattern = declaration.field('name');
			if (
				pattern?.text() !== name &&
				!pattern
					?.findAll({
						rule: {
							any: [
								{ kind: 'identifier' },
								{ kind: 'shorthand_property_identifier_pattern' },
							],
						},
					})
					.some((node) => node.text() === name)
			)
				return false;
			const hoisted =
				declaration.parent()?.is('variable_declaration') ||
				declaration.is('function_declaration') ||
				declaration.is('generator_function_declaration');
			const scope = declaration.ancestors().find(
				(ancestor) =>
					ancestor.matches({ rule: functionScope }) ||
					(!hoisted &&
						ancestor.matches({
							rule: {
								any: [
									{ kind: 'statement_block' },
									{ kind: 'for_statement' },
									{ kind: 'for_in_statement' },
									{ kind: 'switch_body' },
								],
							},
						})),
			);
			return scope?.id() === listener.id() || scope?.id() === body.id();
		});
}

/** The guard adds a path returning undefined; keep explicit callback types valid. */
function widenReturnType(listener: SgNode<Js>): Edit | false | undefined {
	const annotation = listener.field('return_type');
	if (!annotation) return;
	if (!annotation.is('type_annotation')) return false;
	const type = annotation.text().slice(1).trim();
	if (['void', 'undefined', 'any', 'unknown'].includes(type)) return;
	if (!listener.children().some((node) => node.is('async'))) {
		return annotation.replace(`: (${type}) | undefined`);
	}
	const promise = /^Promise<([\s\S]+)>$/.exec(type);
	if (!promise) return false;
	if (['void', 'undefined', 'any', 'unknown'].includes(promise[1].trim()))
		return;
	return annotation.replace(`: Promise<(${promise[1]}) | undefined>`);
}

/** Insert a guard without moving existing code or replacing nested listener bodies. */
function guardBody(
	body: SgNode<Js>,
	name: string,
	baseIndent: string,
	unit: string,
): Edit[] {
	const guard = `if (${name}.writableFinished) return;`;
	const { start, end } = body.range();
	if (body.is('statement_block')) {
		let position = start.index + 1;
		let separator = '';
		// Leave directive prologues (such as 'use strict') at the start of the function.
		for (const statement of body
			.children()
			.filter((node) => node.isNamed() && !node.is('comment'))) {
			if (
				!statement.is('expression_statement') ||
				!statement
					.children()
					.find((node) => node.isNamed())
					?.is('string')
			)
				break;
			position = statement.range().end.index;
			separator = statement.text().trimEnd().endsWith(';') ? '' : ';';
		}
		const newline = body.text().includes('\r\n') ? '\r\n' : '\n';
		const prefix = body.text().includes('\n')
			? `${newline}${baseIndent}${unit}`
			: ' ';
		const next = body.text()[position - start.index];
		const suffix = /\s/.test(next) ? '' : prefix;
		return [
			{
				startPos: position,
				endPos: position,
				insertedText: `${separator}${prefix}${guard}${suffix}`,
			},
		];
	}
	return [
		{
			startPos: start.index,
			endPos: start.index,
			insertedText: `{\n${baseIndent}${unit}${guard}\n${baseIndent}${unit}return `,
		},
		{
			startPos: end.index,
			endPos: end.index,
			insertedText: `;\n${baseIndent}}`,
		},
	];
}
