import type { Edit, SgRoot } from '@codemod.com/jssg-types/main';
import type Json from '@codemod.com/jssg-types/langs/json';
import { intersects, satisfies, validRange } from '@vltpkg/semver';

const REQUIRED_NODE_ENGINE = '^20.19.0 || >=22.12.0';
const REQUIRED_NODE_ANCHORS = ['20.19.0', '20.20.0', '22.12.0', '24.0.0'];

/**
 * Given a current node engine range, returns the best next node engine range to use for an ESM package.
 * If the current range is invalid, doesn't intersect with the required range, or doesn't cover all the required anchors, the required range will be returned.
 * Otherwise, the current range will be returned.
 * This allows to preserve custom node engine ranges as much as possible, while ensuring the resulting range is valid for ESM packages.
 * @param current The current node engine range.
 * @returns The best next node engine range to use for an ESM package.
 */
function chooseBestNodeEngine(current: unknown): string {
	if (typeof current !== 'string' || !validRange(current)) {
		return REQUIRED_NODE_ENGINE;
	}

	if (current === REQUIRED_NODE_ENGINE) {
		return current;
	}

	if (!intersects(current, REQUIRED_NODE_ENGINE)) {
		return REQUIRED_NODE_ENGINE;
	}

	const coversRequiredAnchors = REQUIRED_NODE_ANCHORS.every((version) =>
		satisfies(version, current),
	);

	return coversRequiredAnchors ? REQUIRED_NODE_ENGINE : current;
}

function appendPairToObject(
	objectText: string,
	pairSnippet: string,
	pairIndent: string,
	closingIndent: string,
): string {
	if (objectText.trim() === '{}') {
		return `{\n${pairIndent}${pairSnippet}\n${closingIndent}}`;
	}

	return objectText.replace(
		/\n([ \t]*)}$/,
		`,\n${pairIndent}${pairSnippet}\n$1}`,
	);
}

/**
 * @see https://github.com/nodejs/package-examples/tree/main/guide/05-cjs-esm-migration/migrating-package-json
 */
export default function transform(root: SgRoot<Json>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const topLevelObject = rootNode.find({
		rule: {
			kind: 'object',
		},
	});

	const typePariFeld = rootNode
		.find({
			rule: {
				kind: 'pair',
				has: {
					kind: 'string',
					field: 'key',
					has: {
						kind: 'string_content',
						regex: '^type$',
					},
				},
				inside: {
					kind: 'object',
				},
			},
		})
		?.field('value');
	const topLevelInsertions: string[] = [];

	if (typePariFeld && typePariFeld.text() !== '"module"') {
		edits.push(typePariFeld.replace('"module"'));
	} else if (!typePariFeld) {
		topLevelInsertions.push('"type": "module"');
	}

	const enginesValueField = rootNode
		.find({
			rule: {
				kind: 'pair',
				has: {
					kind: 'string',
					field: 'key',
					has: {
						kind: 'string_content',
						regex: '^engines$',
					},
				},
				inside: {
					kind: 'object',
				},
			},
		})
		?.field('value');

	if (!enginesValueField) {
		topLevelInsertions.push(
			`"engines": {\n    "node": ${JSON.stringify(REQUIRED_NODE_ENGINE)}\n  }`,
		);
	} else if (enginesValueField.kind() !== 'object') {
		edits.push(
			enginesValueField.replace(
				`{\n    "node": ${JSON.stringify(REQUIRED_NODE_ENGINE)}\n  }`,
			),
		);
	} else {
		const nodeEngineValueField = enginesValueField
			.find({
				rule: {
					kind: 'pair',
					has: {
						kind: 'string',
						field: 'key',
						has: {
							kind: 'string_content',
							regex: '^node$',
						},
					},
					inside: {
						kind: 'object',
					},
				},
			})
			?.field('value');

		if (!nodeEngineValueField) {
			edits.push(
				enginesValueField.replace(
					appendPairToObject(
						enginesValueField.text(),
						`"node": ${JSON.stringify(REQUIRED_NODE_ENGINE)}`,
						'    ',
						'  ',
					),
				),
			);
		} else {
			const currentLiteral = nodeEngineValueField
				.find({
					rule: {
						kind: 'string_content',
					},
				})
				?.text();
			const nextRange = chooseBestNodeEngine(currentLiteral);

			if (currentLiteral !== nextRange) {
				edits.push(nodeEngineValueField.replace(JSON.stringify(nextRange)));
			}
		}
	}

	if (topLevelObject && topLevelInsertions.length > 0) {
		let nextTopLevelText = topLevelObject
			.text()
			.replace(/\.cjs(?=")/g, '.mjs')
			.replace(/\.cts(?=")/g, '.mts');

		for (const insertion of topLevelInsertions) {
			nextTopLevelText = appendPairToObject(
				nextTopLevelText,
				insertion,
				'  ',
				'',
			);
		}
		edits.push(topLevelObject.replace(nextTopLevelText));
	} else {
		const cjsStrings = rootNode.findAll({
			rule: {
				kind: 'string_content',
				regex: '\\.cjs$',
			},
		});

		for (const cjsString of cjsStrings) {
			edits.push(cjsString.replace(cjsString.text().replace(/\.cjs$/, '.mjs')));
		}

		const ctsStrings = rootNode.findAll({
			rule: {
				kind: 'string_content',
				regex: '\\.cts$',
			},
		});

		for (const ctsString of ctsStrings) {
			edits.push(ctsString.replace(ctsString.text().replace(/\.cts$/, '.mts')));
		}
	}

	if (!edits.length) return null;

	return rootNode.commitEdits(edits);
}
