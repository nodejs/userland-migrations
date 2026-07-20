import { useMetricAtom } from 'codemod:metrics';
import type { Codemod, Edit, SgNode } from 'codemod:ast-grep';
import type JS from 'codemod:ast-grep/langs/javascript';
import { getNodeImportStatements } from '@nodejs/codemod-utils/ast-grep/import-statement';
import { getNodeRequireCalls } from '@nodejs/codemod-utils/ast-grep/require-call';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';

/**
 * Classes of the http module
 */
const CLASS_NAMES = [
	'Agent',
	'ClientRequest',
	'IncomingMessage',
	'OutgoingMessage',
	'Server',
	'ServerResponse',
];

const callMetric = useMetricAtom('http-classes-with-new-calls');
const filesMetric = useMetricAtom('http-classes-with-new-files');

/**
 * Transform function that converts deprecated node:http classes to use the `new` keyword
 *
 * Handles:
 * 1. `http.Agent()` → `new http.Agent()`
 * 2. `http.ClientRequest()` → `new http.ClientRequest()`
 * 3. `http.IncomingMessage()` → `new http.IncomingMessage()`
 * 4. `http.OutgoingMessage()` → `new http.OutgoingMessage()`
 * 5. `http.Server()` → `new http.Server()`
 * 6. `http.ServerResponse() → `new http.ServerResponse()`
 */
const transform: Codemod<JS> = async (root) => {
	const rootNode = root.root();
	const edits: Edit[] = [];

	const allStatementNodes = [
		...getNodeImportStatements(root, 'http'),
		...getNodeRequireCalls(root, 'http'),
	];

	// if no imports are present it means that we don't need to process the file
	if (!allStatementNodes.length) {
		filesMetric.increment({ status: 'no-changes' });
		return null;
	}

	const classes = new Set<string>(getHttpClassBasePaths(allStatementNodes));

	for (const cls of classes) {
		const classesWithoutNew = rootNode.findAll({
			rule: {
				not: { follows: { pattern: 'new' } },
				pattern: `${cls}($$$ARGS)`,
			},
		});

		for (const clsWithoutNew of classesWithoutNew) {
			edits.push(clsWithoutNew.replace(`new ${clsWithoutNew.text()}`));
			// Extract just the class name from the resolved path (e.g. "http.Agent" → "Agent")
			const className = cls.split('.').at(-1) ?? cls;
			callMetric.increment({ class: className });
		}
	}

	if (edits.length === 0) {
		filesMetric.increment({ status: 'no-changes' });
		return null;
	}

	filesMetric.increment({ status: 'migrated' });

	return rootNode.commitEdits(edits);
};

/**
 * Get the base path of the http classes
 *
 * @param statements - The import & require statements to search for the http classes
 * @returns The base path of the http classes
 */
function* getHttpClassBasePaths(statements: SgNode<JS>[]) {
	for (const cls of CLASS_NAMES) {
		for (const stmt of statements) {
			const resolvedPath = resolveBindingPath(stmt, `$.${cls}`);
			if (resolvedPath) {
				yield resolvedPath;
			}
		}
	}
}

export default transform;
