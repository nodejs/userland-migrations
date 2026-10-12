import type { Edit, SgNode, SgRoot } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';
import { getModuleDependencies } from '@nodejs/codemod-utils/ast-grep/module-dependencies';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import { detectIndentUnit, getLineIndent } from '@nodejs/codemod-utils/ast-grep/indent';
import { EOL } from 'node:os';

const STREAM_CLASSES = [
	'Writable', 'Readable', 'Transform', 'Duplex', 'PassThrough',
];

const OPTION_METHODS = new Set([
	'write', 'writev', 'read', 'transform', 'flush', 'final',
]);

const CLASS_METHODS = new Set([
	'_write', '_writev', '_read', '_transform', '_flush', '_final',
]);

const READ_METHODS = new Set(['read', '_read']);

const FUNCTION_KINDS = new Set([
	'method_definition', 'function_expression', 'function',
	'function_declaration', 'arrow_function', 'generator_function',
	'generator_function_declaration',
]);

const FUNCTION_VALUE_KINDS = new Set([
	'function_expression', 'function', 'arrow_function',
]);

const CHAINABLE_KINDS = new Set([
	'call_expression', 'member_expression', 'subscript_expression',
	'identifier', 'parenthesized_expression',
]);

const NEVER_THENABLE_KINDS = new Set([
	'null', 'undefined', 'true', 'false', 'number', 'string',
	'template_string', 'regex', 'array', 'arrow_function',
	'function_expression', 'function', 'class',
]);

const ARROW_BODY_NEEDS_PARENS = new Set(['object', 'sequence_expression']);

type StreamFunction = { fn: SgNode<Js>; name: string; };

type Step = {
	statement: SgNode<Js>;
	argument: SgNode<Js>;
	name: SgNode<Js> | null;
};

type ExtractedBody = {
	statements: SgNode<Js>[];
	comments: SgNode<Js>[];
	catchParam: string | null;
	catchStatement: SgNode<Js> | null;
};

type Replacement = { start: number; end: number; text: string };

type FileContext = {
	source: string;
	indentUnit: string;
};

/**
 * Transform function that converts async stream implementation methods to the
 * callback form the streams API expects.
 *
 * See DEP0157: https://nodejs.org/api/deprecations.html#DEP0157
 *
 * Handles:
 * 1. async write(chunk, enc, cb) { await a(chunk); cb(); } → a(chunk).then(() => cb()).catch(err => cb(err))
 * 2. Sequential awaits → one .then() link per await, value passed to the next
 * 3. async read(size) { this.push(await d()); } → d().then(v => this.push(v)).catch(err => this.destroy(err))
 * 4. try { await a(); cb(); } catch (err) { cb(err); } → a().then(() => cb()).catch(err => cb(err))
 * 5. write: async function () {} / write: async () => {} (options properties)
 * 6. _write/_writev/_read/_transform/_flush/_final on classes extending a stream
 * 7. Promise<void> return annotations narrowed to void (TypeScript)
 */
export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();

	// Leverage the utils to find exactly what node:stream exposes here
	const streamNames = getStreamClassNames(root);
	if (!streamNames.size) return null;

	const source = rootNode.text();
	const context: FileContext = {
		source,
		indentUnit: detectIndentUnit(source),
	};

	const edits: Edit[] = [];
	const edited: Array<[number, number]> = [];

	for (const target of findStreamFunctions(rootNode, streamNames)) {
		const { start, end } = rangeOf(target.fn);

		if (edited.some(([s, e]) => start < e && s < end)) continue;

		const edit = transformStream(target, context);
		if (!edit) continue;

		edits.push(edit);
		edited.push([start, end]);
	}

	if (!edits.length) return null;

	return rootNode.commitEdits(edits);
}

//find stream classes only
function getStreamClassNames(root: SgRoot<Js>): Set<string> {
	const names = new Set<string>();

	for (const statement of getModuleDependencies(root, 'stream')) {
		for (const className of STREAM_CLASSES) {
			const localPath = resolveBindingPath(statement, `$.${className}`);
			if (localPath) names.add(localPath);
		}
	}

	return names;
}

//find methods in the stream classes
function findStreamFunctions(rootNode: SgNode<Js>, streamNames: Set<string>): StreamFunction[] {
	const found: StreamFunction[] = [];
	const methods = rootNode.findAll({ rule: { kind: 'method_definition' } });

	for (const method of methods) {
		const name = method.field('name')?.text();
		if (!name) continue;

		if (CLASS_METHODS.has(name) && extendsStream(method, streamNames)) {
			found.push({ fn: method, name });
		} else if (
			OPTION_METHODS.has(name) &&
			isStreamOptionsMember(method, streamNames)
		) {
			found.push({ fn: method, name });
		}
	}

	const pairs = rootNode.findAll({ rule: { kind: 'pair' } });

	//check if key -> name & value -> function expression
	for (const pair of pairs) {
		const key = pair.field('key');
		const value = pair.field('value');
		if (!key || !value) continue;

		const name = key.find({ rule: { kind: 'string_fragment' } })?.text() ?? key.text();
		if (
			OPTION_METHODS.has(name) &&
			FUNCTION_VALUE_KINDS.has(value.kind()) &&
			isStreamOptionsMember(pair, streamNames)
		) {
			found.push({ fn: value, name });
		}
	}

	return found;
}

//check if a class method belongs to a class that extends one of stream classes
function extendsStream(member: SgNode<Js>, streamNames: Set<string>): boolean {
	const classBody = member.parent();
	if (!classBody?.is('class_body')) return false;

	const classNode = classBody.parent();
	if (!classNode) return false;

	const heritage = classNode.find({ rule: { kind: 'class_heritage' } });
	if (!heritage) return false;

	const parts = heritage.children().filter((c) => !c.is('extends'));
	const superclass = parts[parts.length - 1];

	return !!superclass && streamNames.has(withoutSpaces(superclass.text()));
}

// Checks if an object method property belongs to options passed
function isStreamOptionsMember(member: SgNode<Js>, streamNames: Set<string>): boolean {
	const object = member.parent();
	if (!object?.is('object')) return false;

	const args = object.parent();
	if (!args?.is('arguments')) return false;

	const newExpression = args.parent();
	if (!newExpression?.is('new_expression')) return false;

	const ctor = newExpression.field('constructor');
	if (!ctor) return false;

	return streamNames.has(withoutSpaces(ctor.text()));
}

//main transromation is done here.
function transformStream({ fn, name }: StreamFunction, context: FileContext): Edit | null {
	const fnChildren = fn.children();

	const asyncToken = fnChildren.find((child) => child.is('async'));
	if (!asyncToken) return null;

	if (fnChildren.some((child) => child.is('*'))) return null;

	const body = fn.field('body');
	if (!body?.is('statement_block')) return null;

	const awaits = body
		.findAll({ rule: { kind: 'await_expression' } })
		.filter((node) => belongsTo(node, fn));

	if (!awaits.length) return null;

	const isRead = READ_METHODS.has(name);
	const callbackName = isRead ? null : getCallbackParamName(fn);

	if (!isRead && !callbackName) return null;
	const extracted = extractBody(body);
	if (!extracted) return null;

	const { statements, comments, catchParam, catchStatement } = extracted;
	if (statements.length < 2) return null;

	const steps: Step[] = [];

	for (const statement of statements.slice(0, -1)) {
		const step = getStep(statement);
		if (!step) return null;

		steps.push(step);
	}

	if (steps.length !== awaits.length) return null;

	const first = steps[0].argument;
	if (NEVER_THENABLE_KINDS.has(first.kind())) return null;

	if (first.text().includes('?.')) return null;

	if (callbackName) {
		const rebindsCallback = steps.some((step) =>
			step.name && getBoundNames(step.name).includes(callbackName)
		);

		if (rebindsCallback) return null;
	}

	const finalStatement = statements[statements.length - 1];

	const finalCall = isRead ? getPushCall(finalStatement)
		: getCallbackCall(finalStatement, callbackName as string);

	if (!finalCall) return null;

	const errorName = catchParam ?? 'err';
	const errorHandler = isRead
		? `this.destroy(${errorName})`
		: `${callbackName}(${errorName})`;

	if (catchStatement && !isCallStatement(catchStatement, errorHandler)) {
		return null;
	}

	if (!hasSafeScoping(steps, finalStatement)) return null;

	// Inlined indentation logic using the provided getLineIndent util
	const bodyRange = rangeOf(body);
	const closingIndent = getLineIndent(context.source, bodyRange.end - 1);
	const bodyIndent = closingIndent + context.indentUnit;
	const chainIndent = bodyIndent + context.indentUnit;

	const lines: string[] = comments.map(
		(c) => `${bodyIndent}${c.text().trim()}`,
	);

	lines.push(`${bodyIndent}${asChainTarget(first)}`);

	for (let i = 1; i <= steps.length; i++) {
		const previous = steps[i - 1];
		const isLast = i === steps.length;
		const consumer = isLast ? finalStatement : steps[i].statement;

		const arrowParam = getArrowParameter(previous, consumer);
		const arrowBody = isLast
			? finalCall
			: asArrowBody(steps[i].argument);

		lines.push(`${chainIndent}.then(${arrowParam} => ${arrowBody})`);
	}

	lines.push(`${chainIndent}.catch(${errorName} => ${errorHandler});`);

	const replacements: Replacement[] = [
		{
			...bodyRange,
			text: `{${EOL}${lines.join(EOL)}${EOL}${closingIndent}}`,
		},
		removeToken(asyncToken, context.source),
	];

	const returnType = fn.field('return_type');

	if (returnType) {
		const replaced = replacePromiseReturnType(returnType);
		if (replaced) replacements.push(replaced);
	}
	return fn.replace(applyReplacements(fn, replacements));
}

//extract body and catch information
function extractBody(body: SgNode<Js>): ExtractedBody | null {
	const statements = getStatements(body);
	const comments = getComments(body);

	if (statements.length === 1 && statements[0].is('try_statement')) {
		const tryStmt = statements[0];

		if (tryStmt.field('finalizer')) {
			return null;
		}

		const tryBlock = tryStmt.field('body');
		const handler = tryStmt.field('handler');

		if (!tryBlock || !handler) return null;

		const parameter = handler.field('parameter');

		if (!parameter?.is('identifier')) return null;

		const handlerBody = handler.field('body');
		if (!handlerBody) return null;

		const handlerStatements = getStatements(handlerBody);
		if (handlerStatements.length !== 1) return null;

		return {
			statements: getStatements(tryBlock),
			comments: [
				...comments,
				...getComments(tryBlock),
				...getComments(handlerBody)
			],
			catchParam: parameter.text(),
			catchStatement: handlerStatements[0],
		};
	}
	return { statements, comments, catchParam: null, catchStatement: null };
}

//find the awaited expression and variable assigned to it
function getStep(statement: SgNode<Js>): Step | null {
	let awaitedNode: SgNode<Js> | null = null;
	let boundName: SgNode<Js> | null = null;

	if (statement.is('expression_statement')) {
		awaitedNode = statement.child(0) ?? null;
	} else if (statement.is('lexical_declaration') || statement.is('variable_declaration')) {
		const decls = statement
			.children()
			.filter((child) => child.is('variable_declarator'));

		if (decls.length !== 1) return null;

		awaitedNode = decls[0].field('value') ?? null;
		boundName = decls[0].field('name') ?? null;
	}
	if (!awaitedNode?.is('await_expression')) return null;
	const argument = awaitedNode
		.children()
		.find((c) => !c.is('await') && !c.is('comment'));

	if (!argument) return null;
	return { statement, argument, name: boundName };
}

//get callback parameter from function
function getCallbackParamName(fn: SgNode<Js>): string | null {
	const params = fn.field('parameters');
	if (!params) return null;

	const list = params
		.children()
		.filter((c) => !['(', ')', ',', 'comment'].includes(c.kind()));

	const last = list[list.length - 1];
	if (!last) return null;

	if (last.is('identifier')) return last.text();

	if (last.is('required_parameter') || last.is('optional_parameter')) {
		const pattern = last.child(0);
		return pattern?.is('identifier') ? pattern.text() : null;
	}
	return null;
}


//removes spaces from sourceText
const withoutSpaces = (text: string) => text.replace(/\s+/g, '');

//get call expression from statement
function getStatementCall(statement: SgNode<Js>): SgNode<Js> | null {
	if (!statement.is('expression_statement') && !statement.is('return_statement')) {
		return null;
	}

	const call = statement
		.children()
		.find((c) => !['return', ';', 'comment'].includes(c.kind()));

	return call?.is('call_expression') ? call : null;
}

//check if call uses expected callee
function getCallWithCallee(
	statement: SgNode<Js>,
	matches: (callee: SgNode<Js>) => boolean,
): string | null {
	const call = getStatementCall(statement);
	const callee = call?.field('function');

	return call && callee && matches(callee) ? call.text() : null;
}

//find callback call from statement
const getCallbackCall = (statement: SgNode<Js>, cbName: string) =>
	getCallWithCallee(
		statement,
		(callee) => callee.is('identifier') && callee.text() === cbName,
	);

//find this.push call from statement
const getPushCall = (statement: SgNode<Js>) =>
	statement.is('expression_statement')
		? getCallWithCallee(
			statement,
			(callee) => withoutSpaces(callee.text()) === 'this.push',
		)
		: null;

//check if statement is expected call
function isCallStatement(statement: SgNode<Js>, expected: string): boolean {
	if (!statement.is('expression_statement')) return false;

	const call = getStatementCall(statement);

	return !!call && withoutSpaces(call.text()) === withoutSpaces(expected);
}

//check if variables are safely scoped after conversion
function hasSafeScoping(steps: Step[], finalStatement: SgNode<Js>): boolean {
	const consumers = [
		...steps.slice(1).map((s) => s.statement),
		finalStatement,
	];

	for (let i = 0; i < steps.length; i++) {
		const name = steps[i].name;
		if (!name) continue;

		const bound = getBoundNames(name);

		for (const later of consumers.slice(i + 1)) {
			if (referencesAny(later, bound)) return false;
		}
	}

	return true;
}

//get variables bound by a node
function getBoundNames(name: SgNode<Js>): string[] {
	if (name.is('identifier')) return [name.text()];

	return name
		.findAll({
			rule: {
				any: [
					{ kind: 'identifier' },
					{ kind: 'shorthand_property_identifier_pattern' },
				],
			},
		})
		.map((node) => node.text());
}

//check if node references any of the supplied names
function referencesAny(node: SgNode<Js>, names: string[]): boolean {
	return node
		.findAll({
			rule: {
				any: [
					{ kind: 'identifier' },
					{ kind: 'shorthand_property_identifier' },
				],
			},
		})
		.some((id) => names.includes(id.text()));
}

//get parameter for generated then callback
function getArrowParameter(step: Step, consumer: SgNode<Js>): string {
	if (!step.name) return '()';

	if (!referencesAny(consumer, getBoundNames(step.name))) {
		return '()';
	}

	if (step.name.is('identifier')) {
		return step.name.text();
	}
	return `(${step.name.text()})`;
}

//convert expression into valid chain target
function asChainTarget(node: SgNode<Js>): string {
	return CHAINABLE_KINDS.has(node.kind()) ? node.text() : `(${node.text()})`;
}

//convert expression into valid arrow body
function asArrowBody(node: SgNode<Js>): string {
	return ARROW_BODY_NEEDS_PARENS.has(node.kind())
		? `(${node.text()})`
		: node.text();
}

//finds who's the parent of passed node.
function belongsTo(node: SgNode<Js>, fn: SgNode<Js>): boolean {
	let current = node.parent();

	while (current) {
		if (FUNCTION_KINDS.has(current.kind())) return sameRange(current, fn);

		current = current.parent();
	}

	return false;
}

//get direct statements from block
function getStatements(block: SgNode<Js>): SgNode<Js>[] {
	return block
		.children()
		.filter((c) => !c.is('{') && !c.is('}') && !c.is('comment'));
}

//get comments directly inside block
function getComments(block: SgNode<Js>): SgNode<Js>[] {
	return block.children().filter((c) => c.is('comment'));
}

//get source range of node
function rangeOf(node: SgNode<Js>): { start: number; end: number } {
	const range = node.range();

	return { start: range.start.index, end: range.end.index };
}

//compare nodes using source range
function sameRange(a: SgNode<Js>, b: SgNode<Js>): boolean {
	const ra = rangeOf(a);
	const rb = rangeOf(b);

	return ra.start === rb.start && ra.end === rb.end;
}

//remove async token and following whitespace
function removeToken(token: SgNode<Js>, source: string): Replacement {
	const { start, end } = rangeOf(token);
	const match = source.slice(end).match(/^[ \t]*/);
	const trailing = match ? match[0].length : 0;

	return { start, end: end + trailing, text: '' };
}

//replace Promise return type with void
function replacePromiseReturnType(returnType: SgNode<Js>): Replacement | null {
	const text = returnType.text();

	if (!/^(:\s*)?Promise\s*</.test(text)) return null;

	return {
		...rangeOf(returnType),
		text: text.startsWith(':') ? ': void' : 'void',
	};
}

//apply replacements from the end so ranges stay valid
function applyReplacements(fn: SgNode<Js>, reps: Replacement[]): string {
	const base = rangeOf(fn).start;
	let text = fn.text();

	for (const r of [...reps].sort((a, b) => b.start - a.start)) {
		text = text.slice(0, r.start - base) + r.text + text.slice(r.end - base);
	}
	return text;
}
