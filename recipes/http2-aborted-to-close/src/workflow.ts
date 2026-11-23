import type { Edit, SgNode, SgRoot } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';
import { getModuleDependencies } from '@nodejs/codemod-utils/ast-grep/module-dependencies';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import { getScope } from '@nodejs/codemod-utils/ast-grep/get-scope';
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
 *   stream.on('close', () => { if (!stream.writableFinished) { body } })
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

const LISTENER_METHODS = new Set([
	'on',
	'once',
	'addListener',
	'prependListener',
	'prependOnceListener',
]);

const LISTENER_QUERY_METHODS = new Set([
	'off',
	'removeListener',
	'removeAllListeners',
	'listeners',
	'rawListeners',
	'listenerCount',
]);

const FUNCTION_KINDS = new Set([
	'arrow_function',
	'function_expression',
	'function',
]);

type StreamBinding = { name: string; scope: SgNode<Js> };

export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const source = rootNode.text();
	const edits: Edit[] = [];

	const http2Statements = getModuleDependencies(root, 'http2');
	if (!http2Statements.length) return null;

	const serverFactories = new Set<string>();
	const connectCallees = new Set<string>();
	for (const stmt of http2Statements) {
		for (const path of ['$.createServer', '$.createSecureServer']) {
			const resolved = resolveBindingPath(stmt, path);
			if (resolved) serverFactories.add(resolved);
		}
		const connect = resolveBindingPath(stmt, '$.connect');
		if (connect) connectCallees.add(connect);
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

	for (const { name, scope } of streams) {
		const calls = scope.findAll({
			rule: { pattern: `${name}.$METHOD($$$ARGS)` },
		});

		const abortedCalls = calls.filter((call) => {
			const args = getArguments(call);
			return args.length > 0 && stringValue(args[0]) === 'aborted';
		});

		const hasListenerQuery = abortedCalls.some((call) =>
			LISTENER_QUERY_METHODS.has(methodName(call) ?? ''),
		);

		for (const call of abortedCalls) {
			const method = methodName(call) ?? '';
			if (!LISTENER_METHODS.has(method)) continue;

			if (hasListenerQuery) {
				warn(
					`'aborted' listeners of \`${name}\` are removed, counted or listed elsewhere; review this listener manually`,
					call,
				);
				continue;
			}

			const [event, listener] = getArguments(call);
			const parent = call.parent();
			if (
				!listener ||
				!FUNCTION_KINDS.has(listener.kind()) ||
				countParameters(listener) !== 0 ||
				parent?.kind() !== 'expression_statement'
			) {
				warn(
					`only inline 'aborted' listeners with no parameters are migrated; review this listener on \`${name}\` manually`,
					call,
				);
				continue;
			}

			const body = listener.field('body');
			if (!body) continue;

			const quote = event.text()[0];
			edits.push(event.replace(`${quote}close${quote}`));

			const baseIndent = getLineIndent(source, call.range().start.index);
			edits.push(body.replace(wrapBody(body, name, baseIndent, indentUnit)));
		}

		for (const read of scope.findAll({
			rule: { pattern: `${name}.aborted` },
		})) {
			warn(
				`\`${name}.aborted\` is deprecated and was not rewritten; choose \`destroyed\`, \`writableFinished\` or \`readableEnded\` for what this code means`,
				read,
			);
		}
	}

	if (!edits.length) return null;
	return rootNode.commitEdits(edits);
}

/**
 * The first parameter of each `'stream'` listener registered on a server
 * created by one of `factories`, scoped to that listener's body.
 */
function findServerStreams(
	rootNode: SgNode<Js>,
	factories: Set<string>,
): StreamBinding[] {
	if (!factories.size) return [];

	const factoryCalls = rootNode
		.findAll({ rule: { kind: 'call_expression' } })
		.filter((call) => factories.has(call.field('function')?.text() ?? ''));

	const serverNames = new Set<string>();
	for (const call of factoryCalls) {
		const name = declaredName(call);
		if (name) serverNames.add(name);
	}

	const streams: StreamBinding[] = [];
	for (const call of rootNode.findAll({
		rule: { pattern: '$SERVER.$METHOD($EVENT, $LISTENER)' },
	})) {
		if (!LISTENER_METHODS.has(methodName(call) ?? '')) continue;

		const [event, listener] = getArguments(call);
		if (stringValue(event) !== 'stream') continue;

		const server = call.field('function')?.field('object');
		if (!server) continue;
		const isServer =
			(server.kind() === 'identifier' && serverNames.has(server.text())) ||
			(server.kind() === 'call_expression' &&
				factoryCalls.some((factory) => factory.id() === server.id()));
		if (!isServer || !FUNCTION_KINDS.has(listener.kind())) continue;

		const name = firstParameterName(listener);
		const body = listener.field('body');
		if (name && body) streams.push({ name, scope: body });
	}
	return streams;
}

/**
 * Variables that hold `session.request(...)`, where `session` holds the
 * result of one of `connectCallees`.
 */
function findClientStreams(
	rootNode: SgNode<Js>,
	connectCallees: Set<string>,
): StreamBinding[] {
	if (!connectCallees.size) return [];

	const sessionNames = new Set<string>();
	for (const call of rootNode.findAll({ rule: { kind: 'call_expression' } })) {
		if (!connectCallees.has(call.field('function')?.text() ?? '')) continue;
		const name = declaredName(call);
		if (name) sessionNames.add(name);
	}

	const streams: StreamBinding[] = [];
	for (const call of rootNode.findAll({
		rule: { pattern: '$SESSION.request($$$ARGS)' },
	})) {
		const session = call.field('function')?.field('object');
		if (!session || !sessionNames.has(session.text())) continue;

		const declarator = call.parent();
		if (declarator?.kind() !== 'variable_declarator') continue;
		const name = declarator.field('name');
		if (name?.kind() !== 'identifier') continue;

		streams.push({ name: name.text(), scope: getScope(declarator) });
	}
	return streams;
}

/** `x` in `const x = <call>`, or undefined. */
function declaredName(call: SgNode<Js>): string | undefined {
	const declarator = call.parent();
	if (declarator?.kind() !== 'variable_declarator') return undefined;
	const name = declarator.field('name');
	return name?.kind() === 'identifier' ? name.text() : undefined;
}

function methodName(call: SgNode<Js>): string | undefined {
	const callee = call.field('function');
	if (callee?.kind() !== 'member_expression') return undefined;
	return callee.field('property')?.text();
}

function getArguments(call: SgNode<Js>): SgNode<Js>[] {
	return (
		call
			.field('arguments')
			?.children()
			.filter((child) => child.isNamed() && child.kind() !== 'comment') ?? []
	);
}

/** The value of a plain string literal, or undefined. */
function stringValue(node: SgNode<Js> | undefined): string | undefined {
	if (node?.kind() !== 'string') return undefined;
	return node.text().slice(1, -1);
}

function parameterNodes(fn: SgNode<Js>): SgNode<Js>[] {
	// `x => ...` has a single `parameter` field instead of `parameters`.
	const single = fn.field('parameter');
	if (single) return [single];
	return (
		fn
			.field('parameters')
			?.children()
			.filter((child) => child.isNamed() && child.kind() !== 'comment') ?? []
	);
}

function countParameters(fn: SgNode<Js>): number {
	return parameterNodes(fn).length;
}

function firstParameterName(fn: SgNode<Js>): string | undefined {
	let param = parameterNodes(fn)[0];
	// TypeScript wraps parameters: `required_parameter` > `pattern`.
	if (param?.kind() === 'required_parameter') {
		param = param.field('pattern') ?? param;
	}
	return param?.kind() === 'identifier' ? param.text() : undefined;
}

/**
 * The listener body wrapped in `if (!<name>.writableFinished) { ... }`, as a
 * block. An expression body becomes one statement in the new block.
 */
function wrapBody(
	body: SgNode<Js>,
	name: string,
	baseIndent: string,
	unit: string,
): string {
	const inner = `${baseIndent}${unit}${unit}`;
	let statements: string[];

	if (body.kind() === 'statement_block') {
		const content = body.text().slice(1, -1);
		if (content.includes('\n')) {
			const lines = content.split(/\r?\n/);
			if (!lines[0].trim()) lines.shift();
			if (lines.length && !lines[lines.length - 1].trim()) lines.pop();
			statements = lines.map((line) => (line.trim() ? unit + line : ''));
		} else {
			statements = content.trim() ? [inner + content.trim()] : [];
		}
	} else {
		statements = [`${inner}${body.text()};`];
	}

	return [
		'{',
		`${baseIndent}${unit}if (!${name}.writableFinished) {`,
		...statements,
		`${baseIndent}${unit}}`,
		`${baseIndent}}`,
	].join('\n');
}
