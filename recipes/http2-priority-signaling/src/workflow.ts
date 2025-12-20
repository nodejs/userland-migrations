import type { Edit, Range, SgNode, SgRoot } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';
import { getNodeRequireCalls } from '@nodejs/codemod-utils/ast-grep/require-call';
import {
	getNodeImportStatements,
	getNodeImportCalls,
} from '@nodejs/codemod-utils/ast-grep/import-statement';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import { removeLines } from '@nodejs/codemod-utils/ast-grep/remove-lines';
import { getScope } from '@nodejs/codemod-utils/ast-grep/get-scope';

/*
 * Transforms HTTP/2 priority-related options and methods.
 *
 * Steps:
 *
 * 1. Find all http2 imports and require calls
 * 2. Find and remove priority property from connect() options
 * 3. Find and remove priority property from request() options
 * 4. Find and remove complete stream.priority() calls
 * 5. Find and remove priority property from settings() options
 */
export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const linesToRemove: Range[] = [];

	// Gather all http2 import/require statements/calls
	const http2Statements = [
		...getNodeImportStatements(root, 'http2'),
		...getNodeRequireCalls(root, 'http2'),
		...getNodeImportCalls(root, 'http2'),
	];

	// If any import do nothing
	if (!http2Statements.length) return null;

	// Resolve all local callee names for http2.connect (handles namespace, default, named, alias, require/import)
	const connectCallees = new Set<string>();
	const sessionVars: { name: string; decl: SgNode<Js>; scope: SgNode<Js> }[] =
		[];

	for (const stmt of http2Statements) {
		if (stmt.kind() === 'expression_statement') {
			const binding = stmt.field('name');
			if (binding) {
				sessionVars.push({
					name: binding.text(),
					decl: stmt,
					scope: getScope(stmt),
				});
			}
		} else {
			const resolved = resolveBindingPath(stmt, '$.connect');
			if (resolved) connectCallees.add(resolved);
		}
	}

	// Discover session variables created via http2.connect or destructured connect calls by
	// locating call expressions and climbing to the variable declarator.
	const connectCalls: SgNode<Js>[] = [
		...rootNode.findAll({ rule: { pattern: '$HTTP2.connect($$$_ARGS)' } }),
		// Also include direct calls when `connect` is imported as a named binding or alias (e.g., `connect(...)` or `bar(...)`).
		...Array.from(connectCallees).flatMap((callee) => {
			// If callee already includes a dot (e.g., http2.connect), the pattern above already matches it.
			if (callee.includes('.')) return [] as SgNode<Js>[];
			return rootNode.findAll({ rule: { pattern: `${callee}($$$_ARGS)` } });
		}),
	];

	for (const call of connectCalls) {
		let n: SgNode<Js> | undefined = call;
		while (n && n.kind() !== 'variable_declarator') {
			n = n.parent();
		}
		if (!n) continue;
		const nameNode = (n as SgNode<Js, 'variable_declarator'>).field('name');
		if (!nameNode) continue;
		sessionVars.push({
			name: nameNode.text(),
			decl: n,
			scope: getScope(n),
		});
	}

	// Case 1: Remove priority object from http2.connect() options (direct call sites)
	edits.push(...removeConnectPriority(rootNode));

	// Case 2: Remove priority from session.request() options scoped to discovered session vars + chained connect().request.
	edits.push(...removeRequestPriority(rootNode, sessionVars));

	// Determine stream variables created from session.request() or connect().request().
	const streamVars = collectStreamVars(rootNode, sessionVars);

	// Case 3: Remove entire stream.priority() calls only for:
	//   - chained request().priority()
	//   - variables assigned from session.request/connect().request
	const result3 = removePriorityMethodCalls(rootNode, streamVars);
	edits.push(...result3.edits);
	linesToRemove.push(...result3.linesToRemove);

	// Case 4: Remove priority property from session.settings() options scoped to session vars + chained connect().settings.
	edits.push(...removeSettingsPriority(rootNode, sessionVars));

	if (!edits.length && !linesToRemove.length) return null;

	const sourceCode = rootNode.commitEdits(edits);

	return removeLines(sourceCode, linesToRemove);
}

/**
 * Remove priority property from http2.connect() call options
 */
function removeConnectPriority(rootNode: SgNode<Js>): Edit[] {
	const edits: Edit[] = [];

	// Match any connect() call
	const connectCalls = rootNode.findAll({
		rule: {
			pattern: '$HTTP2.connect($$$ARGS)',
		},
	});

	for (const call of connectCalls) {
		const objects = call.findAll({
			rule: {
				kind: 'object',
			},
		});

		for (const obj of objects) {
			// Check if object only contains priority properties
			// Get immediate children pairs only (not nested)
			const pairs = obj.children().filter((child) => child.kind() === 'pair');

			let hasPriority = false;
			let allPriority = true;

			for (const pair of pairs) {
				const keyNode = pair.find({
					rule: {
						kind: 'property_identifier',
						regex: '^priority$',
					},
				});

				if (keyNode) {
					hasPriority = true;
				} else {
					allPriority = false;
				}
			}

			if (allPriority && hasPriority) {
				// Remove the entire object argument from the call
				const callText = call.text();
				const objText = obj.text();
				// Use s flag to match across newlines (including the multiline object)
				const cleanedCall = callText.replace(
					new RegExp(`(,\\s*)?${escapeRegex(objText)}(,\\s*)?`, 's'),
					'',
				);

				if (cleanedCall !== callText) {
					edits.push(call.replace(cleanedCall));
				}
			} else if (hasPriority) {
				// Object has other properties, so just remove priority pair
				edits.push(...removePriorityPairFromObject(obj));
			}
		}
	}

	return edits;
}

/**
 * Remove priority property from session.request() call options
 */
function removeRequestPriority(
	rootNode: SgNode<Js>,
	sessionVars: { name: string; scope: SgNode<Js> }[],
): Edit[] {
	const edits: Edit[] = [];

	// Chained connect().request(...) still safe regardless of variable binding.
	const chained = rootNode.findAll({
		rule: { pattern: '$HTTP2.connect($$$_ARGS).request($$ARGS)' },
	});
	const allCalls: SgNode<Js>[] = [...chained];

	// Scoped session.request calls based on discovered session variables.
	for (const sess of sessionVars) {
		const calls = sess.scope.findAll({
			rule: {
				kind: 'call_expression',
				has: {
					field: 'function',
					kind: 'member_expression',
					pattern: `${sess.name}.request`,
				},
			},
		});
		allCalls.push(...calls);
	}

	for (const call of allCalls) {
		const objects = call.findAll({
			rule: {
				kind: 'object',
			},
		});
		for (const obj of objects) {
			const pairs = obj.children().filter((child) => child.kind() === 'pair');

			let hasPriority = false;
			let allPriority = true;

			for (const pair of pairs) {
				const keyNode = pair.find({
					rule: { kind: 'property_identifier', regex: '^priority$' },
				});
				if (keyNode) hasPriority = true;
				else allPriority = false;
			}

			if (!allPriority || !hasPriority) {
				edits.push(...removePriorityPairFromObject(obj));
			}
		}
	}
	return edits;
}

/**
 * Remove entire stream.priority() method calls
 */
function removePriorityMethodCalls(
	rootNode: SgNode<Js>,
	streamVars: { name: string; scope: SgNode<Js> }[],
): { edits: Edit[]; linesToRemove: Range[] } {
	const edits: Edit[] = [];
	const linesToRemove: Range[] = [];

	// Chained request(...).priority(...) directly (session or connect chains)
	const chained = rootNode.findAll({
		rule: { pattern: '$SESSION.request($$$_ARGS).priority($$$ARGS)' },
	});
	const chainedConnect = rootNode.findAll({
		rule: {
			pattern: '$HTTP2.connect($$$_ARGS).request($$ARGS).priority($$$ARGS)',
		},
	});

	const safeCalls = new Set<SgNode<Js>>([...chained, ...chainedConnect]);

	// Priority on identified stream variable names within their scope.
	for (const stream of streamVars) {
		const calls = stream.scope.findAll({
			rule: {
				kind: 'call_expression',
				has: {
					field: 'function',
					kind: 'member_expression',
					pattern: `${stream.name}.priority`,
				},
			},
		});

		for (const c of calls) safeCalls.add(c);
	}

	// Remove expression statements containing safe priority calls.
	for (const call of safeCalls) {
		let node: SgNode<Js> | undefined = call;

		while (node) {
			const parent = node.parent();

			if (parent?.kind() === 'expression_statement') {
				linesToRemove.push(parent.range());
				break;
			}
			node = parent;
		}
	}
	return { edits, linesToRemove };
}

/**
 * Remove priority from settings() call
 */
function removeSettingsPriority(
	rootNode: SgNode<Js>,
	sessionVars: { name: string; scope: SgNode<Js> }[],
): Edit[] {
	const edits: Edit[] = [];
	// Chained connect().settings(...)
	const chained = rootNode.findAll({
		rule: { pattern: '$HTTP2.connect($$$_ARGS).settings($$$_ARGS)' },
	});

	const safeCalls = new Set<SgNode<Js>>([...chained]);

	// Scoped session.settings calls for discovered session variables.
	for (const sess of sessionVars) {
		const calls = sess.scope.findAll({
			rule: {
				kind: 'call_expression',
				has: {
					field: 'function',
					kind: 'member_expression',
					pattern: `${sess.name}.settings`,
				},
			},
		});
		for (const c of calls) safeCalls.add(c);
	}

	for (const call of safeCalls) {
		const objects = call.findAll({ rule: { kind: 'object' } });

		for (const obj of objects) {
			const pairs = obj.children().filter((child) => child.kind() === 'pair');

			let hasPriority = false;
			let allPriority = true;

			for (const pair of pairs) {
				const keyNode = pair.find({
					rule: { kind: 'property_identifier', regex: '^priority$' },
				});
				if (keyNode) hasPriority = true;
				else allPriority = false;
			}

			if (!allPriority || !hasPriority) {
				edits.push(...removePriorityPairFromObject(obj));
			}
		}
	}
	return edits;
}

// Collect stream variables created from session.request() or connect().request() patterns.
function collectStreamVars(
	rootNode: SgNode<Js>,
	sessionVars: { name: string; scope: SgNode<Js> }[],
): { name: string; scope: SgNode<Js> }[] {
	const streamVars: { name: string; scope: SgNode<Js> }[] = [];

	// From sessionVar.request(...)
	for (const sess of sessionVars) {
		const decls = sess.scope.findAll({
			rule: {
				kind: 'variable_declarator',
				has: {
					field: 'value',
					kind: 'call_expression',
					has: {
						field: 'function',
						kind: 'member_expression',
						pattern: `${sess.name}.request`,
					},
				},
			},
		});
		for (const d of decls) {
			const nameNode = d.field('name');
			streamVars.push({ name: nameNode.text(), scope: getScope(d) });
		}
	}
	// From connect().request(...) chained assignments.
	const chainedDecls = rootNode.findAll({
		rule: {
			kind: 'variable_declarator',
			has: {
				field: 'value',
				kind: 'call_expression',
				has: {
					field: 'function',
					kind: 'member_expression',
					pattern: 'request', // we will validate parent chain text
				},
			},
		},
	});
	for (const d of chainedDecls) {
		const valueText = d.field('value').text();
		// Quick heuristic: contains ".connect(" before ".request(".
		if (/connect\s*\([^)]*\).*\.request\s*\(/.test(valueText)) {
			const nameNode = d.field('name');
			streamVars.push({ name: nameNode.text(), scope: getScope(d) });
		}
	}
	return streamVars;
}

/**
 * Find and remove priority pair from an object, handling commas properly
 */
function removePriorityPairFromObject(obj: SgNode<Js>): Edit[] {
	const edits: Edit[] = [];

	const pairs = obj.findAll({
		rule: {
			kind: 'pair',
		},
	});

	// Find all priority pairs
	const priorityPairs: SgNode<Js>[] = [];
	for (const pair of pairs) {
		const keyNode = pair.find({
			rule: {
				kind: 'property_identifier',
				regex: '^priority$',
			},
		});

		if (keyNode) {
			priorityPairs.push(pair);
		}
	}

	if (priorityPairs.length === 0) {
		return edits;
	}

	// If all pairs are priority, remove the entire object
	if (priorityPairs.length === pairs.length) {
		edits.push(obj.replace(''));
		return edits;
	}

	// Otherwise, we need to remove pairs and clean up commas
	// Strategy: replace the object with a cleaned version
	const objText = obj.text();
	let result = objText;

	// For each priority pair, remove it along with associated comma
	for (const pair of priorityPairs) {
		const pairText = pair.text();

		// Try to match and remove: ", priority: {...}" or similar
		// First try with leading comma
		const leadingCommaPattern = `,\\s*${escapeRegex(pairText)}`;
		if (result.includes(',') && result.includes(pairText)) {
			result = result.replace(new RegExp(leadingCommaPattern), '');
		}

		// If still not removed, try with trailing comma
		if (result.includes(pairText)) {
			const trailingCommaPattern = `${escapeRegex(pairText)},`;
			result = result.replace(new RegExp(trailingCommaPattern), '');
		}

		// If still not removed, just remove the pair
		if (result.includes(pairText)) {
			result = result.replace(pairText, '');
		}
	}

	// if changes were made, create the edit
	if (result !== objText) {
		edits.push(obj.replace(result));
	}

	return edits;
}

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
