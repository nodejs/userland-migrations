import type {
	Edit,
	Range,
	SgNode,
	SgRoot,
} from "@codemod.com/jssg-types/main";
import type Js from "@codemod.com/jssg-types/langs/javascript";
import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";
import { getNodeImportStatements } from "@nodejs/codemod-utils/ast-grep/import-statement";
import { removeLines } from "@nodejs/codemod-utils/ast-grep/remove-lines";

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

	// Get all http2 imports/requires
	const http2Statements = [
		...getNodeImportStatements(root, "http2"),
		...getNodeRequireCalls(root, "http2")
	];

	if (!http2Statements.length) return null;

	// Case 1: Remove priority object from http2.connect() options
	edits.push(...removeConnectPriority(rootNode));

	// Case 2: Remove priority object from session.request() options
	edits.push(...removeRequestPriority(rootNode));

	// Case 3: Remove entire stream.priority() method calls
	const result3 = removePriorityMethodCalls(rootNode);
	edits.push(...result3.edits);
	linesToRemove.push(...result3.linesToRemove);

	// Case 4: Remove priority property from client.settings() options
	edits.push(...removeSettingsPriority(rootNode));

	if (!edits.length && linesToRemove.length === 0) return null;

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
			pattern: "$HTTP2.connect($$$ARGS)",
		},
	});

	for (const call of connectCalls) {
		const objects = call.findAll({
			rule: {
				kind: "object",
			},
		});

		for (const obj of objects) {
			// Check if object only contains priority properties
			// Get immediate children pairs only (not nested)
			const pairs = obj.children().filter((child) => child.kind() === "pair");

			let hasPriority = false;
			let allPriority = true;

			for (const pair of pairs) {
				const keyNode = pair.find({
					rule: {
						kind: "property_identifier",
						regex: "^priority$",
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
				const cleanedCall = callText.replace(new RegExp(`(,\\s*)?${escapeRegex(objText)}(,\\s*)?`, "s"), "");
				const finalCall = cleanedCall.replace(/,\s*\)/, ")");

				if (finalCall !== callText) {
					edits.push(call.replace(finalCall));
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
function removeRequestPriority(rootNode: SgNode<Js>): Edit[] {
	const edits: Edit[] = [];

	// Find all request calls and clean priority from their options
	const requestCalls = rootNode.findAll({
		rule: {
			pattern: "$SESSION.request($$$_ARGS)",
		},
	});

	for (const call of requestCalls) {
		const objects = call.findAll({
			rule: {
				kind: "object",
			},
		});

		for (const obj of objects) {
			// Check if object only contains priority properties
			// Get immediate children pairs only (not nested)
			const pairs = obj.children().filter((child) => child.kind() === "pair");

			let hasPriority = false;
			let allPriority = true;

			for (const pair of pairs) {
				const keyNode = pair.find({
					rule: {
						kind: "property_identifier",
						regex: "^priority$",
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
				const cleanedCall = callText.replace(new RegExp(`(,\\s*)?${escapeRegex(objText)}(,\\s*)?`, "s"), "");
				const finalCall = cleanedCall.replace(/,\s*\)/, ")");

				if (finalCall !== callText) {
					edits.push(call.replace(finalCall));
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
 * Remove entire stream.priority() method calls
 */
function removePriorityMethodCalls(
	rootNode: SgNode<Js>,
): { edits: Edit[]; linesToRemove: Range[] } {
	const edits: Edit[] = [];
	const linesToRemove: Range[] = [];

	const priorityCalls = rootNode.findAll({
		rule: {
			pattern: "$STREAM.priority($$$ARGS)",
		},
	});

	for (const call of priorityCalls) {
		// Find the statement containing this call and remove it with its newline
		let node: SgNode<Js> | undefined = call;
		while (node) {
			const parent = node.parent();
			const parentKind = parent?.kind();

			// Found the statement level
			if (parentKind === "expression_statement") {
				// Add this line to the lines to remove
				linesToRemove.push(parent!.range());
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
function removeSettingsPriority(rootNode: SgNode<Js>): Edit[] {
	const edits: Edit[] = [];

	const settingsCalls = rootNode.findAll({
		rule: {
			pattern: "$SESSION.settings($$$_ARGS)",
		},
	});

	for (const call of settingsCalls) {
		const objects = call.findAll({
			rule: {
				kind: "object",
			},
		});

		for (const obj of objects) {
			// Check if object only contains priority properties
			// Get immediate children pairs only (not nested)
			const pairs = obj.children().filter((child) => child.kind() === "pair");

			let hasPriority = false;
			let allPriority = true;

			for (const pair of pairs) {
				const keyNode = pair.find({
					rule: {
						kind: "property_identifier",
						regex: "^priority$",
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
				const cleanedCall = callText.replace(new RegExp(`(,\\s*)?${escapeRegex(objText)}(,\\s*)?`, "s"), "");
				const finalCall = cleanedCall.replace(/,\s*\)/, ")");

				if (finalCall !== callText) {
					edits.push(call.replace(finalCall));
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
 * Find and remove priority pair from an object, handling commas properly
 */
function removePriorityPairFromObject(obj: SgNode<Js>): Edit[] {
	const edits: Edit[] = [];

	const pairs = obj.findAll({
		rule: {
			kind: "pair",
		},
	});

	// Find all priority pairs
	const priorityPairs: SgNode<Js>[] = [];
	for (const pair of pairs) {
		const keyNode = pair.find({
			rule: {
				kind: "property_identifier",
				regex: "^priority$",
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
		edits.push(obj.replace(""));
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
		if (result.includes(",") && result.includes(pairText)) {
			result = result.replace(new RegExp(leadingCommaPattern), "");
		}

		// If still not removed, try with trailing comma
		if (result.includes(pairText)) {
			const trailingCommaPattern = `${escapeRegex(pairText)},`;
			result = result.replace(new RegExp(trailingCommaPattern), "");
		}

		// If still not removed, just remove the pair
		if (result.includes(pairText)) {
			result = result.replace(pairText, "");
		}
	}

	// Clean up any resulting spacing issues
	result = result.replace(/,\s*,/g, ",");
	result = result.replace(/{\s*,/g, "{");
	result = result.replace(/,\s*}/g, "}");
	result = result.replace(/{(\S)/g, "{ $1");
	result = result.replace(/(\S)}/g, "$1 }");

	if (result !== objText) {
		edits.push(obj.replace(result));
	}

	return edits;
}

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
