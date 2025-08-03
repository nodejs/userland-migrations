import type { SgRoot, Edit, SgNode } from "@codemod.com/jssg-types/main";
import type JS from "@codemod.com/jssg-types/langs/javascript";

/**
 * Transforms url.format() calls to new URL().toString()
 * @param callNode The AST node representing the url.format() call
 * @returns The transformed code
 */
function urlFormatToUrlToString(callNode: SgNode<JS>[], edits: Edit[]): void {
	for (const call of callNode) {
		const optionsMatch = call.getMatch("OPTIONS");
		if (!optionsMatch) continue;

		// Find the object node that contains the URL options
		const objectNode = optionsMatch.find({
			rule: {
				kind: "object"
			}
		});

		if (!objectNode) continue;

		// Extract URL components using AST traversal
		const urlComponents = {
			protocol: '',
			hostname: '',
			pathname: '',
			search: ''
		};

		// Find all property pairs in the object
		const pairs = objectNode.findAll({
			rule: {
				kind: "pair"
			}
		});

		for (const pair of pairs) {
			// Get the property key
			const keyNode = pair.find({
				rule: {
					kind: "property_identifier"
				}
			});

			// Get the string value
			const valueNode = pair.find({
				rule: {
					kind: "string"
				}
			});

			if (keyNode && valueNode) {
				const key = keyNode.text();
				// Get the string fragment (the actual content without quotes)
				const stringFragment = valueNode.find({
					rule: {
						kind: "string_fragment"
					}
				});

				const value = stringFragment ? stringFragment.text() : valueNode.text().slice(1, -1);

				// Map the properties to URL components
				if (key === 'protocol') urlComponents.protocol = value;
				else if (key === 'hostname') urlComponents.hostname = value;
				else if (key === 'pathname') urlComponents.pathname = value;
				else if (key === 'search') urlComponents.search = value;
				else console.warn(`Unknown URL option: ${key}`);
			}
		}

		// Construct the URL string
		const urlString = `${urlComponents.protocol}://${urlComponents.hostname}${urlComponents.pathname}${urlComponents.search}`;

		// Replace the entire call with new URL().toString()
		const replacement = `new URL('${urlString}').toString()`;
		edits.push(call.replace(replacement));
	}
}

/**
 * Transforms `url.format` usage to `new URL().toString()`.
 *
 * See https://nodejs.org/api/deprecations.html#DEP0116
 *
 * Handle:
 * 1. `url.format(options)` → `new URL().toString()`
 * 2. `format(options)` → `new URL().toString()`
 * if imported with aliases
 * 2. `foo.format(options)` → `new URL().toString()`
 * 3. `foo(options)` → `new URL().toString()`
 */
export default function transform(root: SgRoot<JS>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	let hasChanges = false;

	// 1. Find all `url.format(options)` calls
	const urlFormatCalls = rootNode.findAll({
		// TODO(@AugustinMauroy): use burno's utility (not merged yet)
		rule: { pattern: "url.format($OPTIONS)" }
	});

	// 2. Find all `format(options)` calls
	if (urlFormatCalls.length > 0) {
		urlFormatToUrlToString(urlFormatCalls, edits);
		hasChanges = edits.length > 0;
	}

	if (!hasChanges) return null;

	return rootNode.commitEdits(edits);
};
