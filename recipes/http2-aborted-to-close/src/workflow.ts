import type { Edit, Rule, SgNode, SgRoot } from '@codemod.com/jssg-types/main';
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

/** Regex that matches exactly one of `names`. */
const exactly = (names: Iterable<string>) =>
	`^(${[...names].map((name) => name.replace(/[.$]/g, '\\$&')).join('|')})$`;

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
		const listeners = scope.findAll({
			rule: { pattern: `${name}.$METHOD($EVENT, $LISTENER)` },
			constraints: {
				METHOD: { regex: LISTENER_METHODS },
				EVENT: stringLiteral('aborted'),
			},
		});

		const hasListenerQuery = !!scope.find({
			rule: {
				pattern: `${name}.$METHOD($$$ARGS)`,
				// The event is the first argument; `removeAllListeners` may have no other.
				has: {
					field: 'arguments',
					has: { nthChild: 1, ...stringLiteral('aborted') },
				},
			},
			constraints: { METHOD: { regex: LISTENER_QUERY_METHODS } },
		});

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

			edits.push(fragment.replace('close'));

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

	const factoryCall: Rule<Js> = {
		any: [...factories].map((factory) => ({ pattern: `${factory}($$$ARGS)` })),
	};

	// `const server = createServer()`
	const serverNames = declaredNames(rootNode, factoryCall);

	// `server.on('stream', ...)` or `createServer().on('stream', ...)`
	const server: Rule<Js> = serverNames.size
		? {
				any: [{ kind: 'identifier', regex: exactly(serverNames) }, factoryCall],
			}
		: factoryCall;

	const streams: StreamBinding[] = [];
	for (const call of rootNode.findAll({
		rule: { pattern: '$SERVER.$METHOD($EVENT, $LISTENER)' },
		constraints: {
			SERVER: server,
			METHOD: { regex: LISTENER_METHODS },
			EVENT: stringLiteral('stream'),
			LISTENER: INLINE_FUNCTION,
		},
	})) {
		const listener = call.getMatch('LISTENER');
		const name = listener && firstParameterName(listener);
		const body = listener?.field('body');
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

	const sessionNames = declaredNames(rootNode, {
		any: [...connectCallees].map((callee) => ({
			pattern: `${callee}($$$ARGS)`,
		})),
	});
	if (!sessionNames.size) return [];

	return rootNode
		.findAll({
			rule: {
				kind: 'variable_declarator',
				all: [
					{ has: { field: 'name', kind: 'identifier' } },
					{ has: { field: 'value', pattern: '$SESSION.request($$$ARGS)' } },
				],
			},
			constraints: { SESSION: { regex: exactly(sessionNames) } },
		})
		.map((declarator) => ({
			name: declarator.field('name')?.text() ?? '',
			scope: getScope(declarator),
		}))
		.filter(({ name }) => name);
}

/** Names declared as `const name = <value>`, where `<value>` matches `value`. */
function declaredNames(rootNode: SgNode<Js>, value: Rule<Js>): Set<string> {
	const names = new Set<string>();
	for (const declarator of rootNode.findAll({
		rule: {
			kind: 'variable_declarator',
			all: [
				{ has: { field: 'name', kind: 'identifier' } },
				{ has: { field: 'value', ...value } },
			],
		},
	})) {
		const name = declarator.field('name')?.text();
		if (name) names.add(name);
	}
	return names;
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

function firstParameterName(fn: SgNode<Js>): string | undefined {
	let param = parameterNodes(fn)[0];
	// TypeScript wraps parameters: `required_parameter` > `pattern`.
	if (param?.is('required_parameter')) {
		param = param.field('pattern') ?? param;
	}
	return param?.is('identifier') ? param.text() : undefined;
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

	if (body.is('statement_block')) {
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
