import type { SgRoot, SgNode, Edit } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';
import { getModuleDependencies } from '@nodejs/codemod-utils/ast-grep/module-dependencies';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';

type QueueEvent = {
	name: keyof typeof parsers;
	handler: () => Edit[];
};

const SUPPORTED_HTTP_METHODS = ['createServer', 'on'];
const SUPPORTED_SERVER_METHODS = ['on'];
const replaceMap = {
	_headers: 'getHeaders()',
	_headerNames: 'getRawHeaderNames()',
};
const queue: QueueEvent[] = [];

function addResponseArgToQueue(node: SgNode<Js, 'arrow_function'>) {
	const resArgs = node.field('parameters').findAll<'identifier'>({
		rule: {
			kind: 'identifier',
		},
	});

	if (resArgs.length >= 2) {
		const responseArg = resArgs[1]; // second arg that is OutgoingMessage.prototype (normally called res)

		queue.unshift({
			name: 'responseReference',
			handler: () => parsers.responseReference(responseArg),
		});
	}
}

const parsers = {
	createServer: (node: SgNode<Js, 'call_expression'>): Edit[] => {
		const serverVar = node
			.find<'variable_declarator'>({
				rule: {
					inside: {
						kind: 'variable_declarator',
					},
				},
			})
			.field('name');

		queue.unshift({
			name: 'scanHttpServerReferences',
			handler: () => parsers.scanHttpServerReferences(serverVar),
		});

		const createServerHandler = node.field('arguments').find<'arrow_function'>({
			rule: {
				any: [
					{
						kind: 'arrow_function',
					},
					{
						kind: 'function_expression',
					},
				],
			},
		});

		addResponseArgToQueue(createServerHandler);

		return [];
	},
	scanHttpServerReferences: (
		serverNode:
			| SgNode<Js, 'identifier'>
			| SgNode<Js, 'array_pattern'>
			| SgNode<Js, 'object_pattern'>,
	): Edit[] => {
		const refs = serverNode.references();

		for (const ref of refs) {
			for (const node of ref.nodes) {
				const fn = node.find<'call_expression'>({
					rule: {
						inside: {
							kind: 'call_expression',
							stopBy: 'end',
						},
					},
				});

				const fnName = node.find({
					rule: {
						inside: {
							kind: 'member_expression',
						},
					},
				});

				const method = (fnName as SgNode<Js, 'member_expression'>)
					.field('property')
					.text();

				switch (method) {
					case 'on':
						const argEvent = fn.field('arguments').find({
							rule: {
								any: [
									{
										kind: 'string_fragment',
									},
								],
							},
						});
						const argListener = fn.field('arguments').find<'arrow_function'>({
							rule: {
								any: [
									{
										kind: 'arrow_function',
									},
									{
										kind: 'function_expression',
									},
								],
							},
						});

						if (argEvent?.text() === 'request' && argListener) {
							addResponseArgToQueue(argListener);
						}

						break;
				}
			}
		}

		return [];
	},
	responseReference: (responseNode: SgNode<Js, 'identifier'>): Edit[] => {
		const edits: Edit[] = [];
		const refs = responseNode.references();

		for (const ref of refs) {
			for (const node of ref.nodes) {
				const memberExpressionNode = node.find<'member_expression'>({
					rule: {
						inside: {
							kind: 'member_expression',
						},
					},
				});
				const resProperty = memberExpressionNode.field('property');
				if (resProperty?.text() in replaceMap) {
					const edit = resProperty.replace(
						replaceMap[resProperty.text() as keyof typeof replaceMap],
					);
					edits.push(edit);
				}
			}
		}

		return edits;
	},
};

export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	let edits: Edit[] = [];
	const httpHandlers = [];

	const modDependencies = getModuleDependencies(root, 'http');

	let httpImports = [];
	for (const dep of modDependencies) {
		const binding = resolveBindingPath(dep, '$.createServer');
		const localVarName = binding.split('.')[0];
		httpImports.push(
			dep.find({
				rule: {
					kind: 'identifier',
					pattern: localVarName,
				},
			}),
		);
	}

	for (const http of httpImports) {
		const references = http.references();

		for (const reference of references) {
			if (reference.root.filename() === root.filename()) {
				for (const nodes of reference.nodes) {
					const node = nodes.find<'call_expression'>({
						rule: {
							inside: {
								kind: 'call_expression',
								stopBy: 'end',
							},
						},
					});

					if (node) {
						const fn = node.field<'function'>('function');

						if (fn.is('member_expression')) {
							const method = (fn as SgNode<Js, 'member_expression'>)
								.field('property')
								.text();
							if (SUPPORTED_HTTP_METHODS.includes(method)) {
								queue.unshift({
									name: method as keyof typeof parsers,
									handler: () => parsers[method as 'createServer'](node),
								});
							}
						}
					}
				}
			}
		}
	}

	while (queue.length) {
		const event = queue.at(-1);
		edits = edits.concat(event.handler());
		queue.pop();
	}

	if (!edits.length) return null;
	return rootNode.commitEdits(edits);
}
