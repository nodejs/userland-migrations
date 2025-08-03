import type { SgRoot, Edit, SgNode } from "@codemod.com/jssg-types/main";

type ImportType =
    | 'DESTRUCTURED_REQUIRE'
    | 'NAMESPACE_REQUIRE'
    | 'DESTRUCTURED_IMPORT'
    | 'NAMESPACE_IMPORT';

function ensureTlsImport(
    rootNode: SgNode,
    edits: Edit[],
    importType: ImportType,
    tlsImportState: { added: boolean; identifier: string },
): string {
    if (tlsImportState.added) {
        return tlsImportState.identifier;
    }

    const isEsm =
        importType === 'DESTRUCTURED_IMPORT' || importType === 'NAMESPACE_IMPORT';
    const moduleSpecifier = 'node:tls';

    const findRule = {
        rule: {
            kind: isEsm ? 'import_statement' : 'variable_declarator',
            has: {
                field: isEsm ? 'source' : 'value',
                has: { regex: `^['"](node:)?tls['"]$` },
            },
        },
    };
    const existingTlsImport = rootNode.find(findRule);

    if (existingTlsImport) {
        const nameNode = existingTlsImport.field('name');
        if (nameNode?.is('identifier')) {
            tlsImportState.identifier = nameNode.text();
            tlsImportState.added = true;
            return tlsImportState.identifier;
        }
    }

    const firstNode = rootNode.children()[0];
    if (firstNode) {
        const newImportText = isEsm
            ? `import * as ${tlsImportState.identifier} from '${moduleSpecifier}';\n`
            : `const ${tlsImportState.identifier} = require('${moduleSpecifier}');\n`;

        const edit = {
            startPos: firstNode.range().start.index,
            endPos: firstNode.range().start.index,
            insertedText: newImportText,
        };
        edits.push(edit);
    }

    tlsImportState.added = true;
    return tlsImportState.identifier;
}

function handleDestructuredImport(
    statement: SgNode,
    rootNode: SgNode,
    edits: Edit[],
    tlsImportState: { added: boolean },
) {
    const isEsm = statement.kind() === 'import_statement';

    let specifiersNode;
    if (isEsm) {
        specifiersNode =
            statement.find({ rule: { kind: 'named_imports' } }) ??
            statement.field('imports');
    } else {
        const declaratorFindRule = {
            rule: {
                kind: 'variable_declarator',
                has: {
                    field: 'value',
                    kind: 'call_expression',
                    has: {
                        field: 'arguments',
                        has: { regex: "^['\"](node:)?crypto['\"]$" },
                    },
                },
            },
        };
        const declarator = statement.find(declaratorFindRule);
        specifiersNode = declarator?.field('name');
    }

    if (!specifiersNode) {
        return false;
    }

    const findPropsRule = {
        rule: {
            any: [
                { kind: 'shorthand_property_identifier_pattern' },
                { kind: 'import_specifier' },
            ],
        },
    };
    const destructuredProps = specifiersNode.findAll(findPropsRule);

    const createCredentialsNode = destructuredProps.find(
        (id) => id.text() === 'createCredentials',
    );

    if (!createCredentialsNode) {
        return false;
    }

    const usagesFindRule = {
        rule: {
            kind: 'call_expression',
            has: {
                field: 'function',
                kind: 'identifier',
                regex: '^createCredentials$',
            },
        },
    };
    const usages = rootNode.findAll(usagesFindRule);
    for (const usage of usages) {
        const functionIdentifier = usage.field('function');
        if (functionIdentifier) {
            edits.push(functionIdentifier.replace('createSecureContext'));
        }
    }

    const newImportModule = 'node:tls';
    const newImportFunction = 'createSecureContext';
    const newImportStatement = isEsm
        ? `import { ${newImportFunction} } from '${newImportModule}';`
        : `const { ${newImportFunction} } = require('${newImportModule}');`;

    if (destructuredProps.length === 1) {
        edits.push(statement.replace(newImportStatement));
        tlsImportState.added = true;
    } else {
        const otherProps = destructuredProps
            .filter((id) => id.text() !== 'createCredentials')
            .map((id) => id.text());

        const newDestructuredString = `{ ${otherProps.join(', ')} }`;
        edits.push(specifiersNode.replace(newDestructuredString));

        if (!tlsImportState.added) {
            const newEdit = {
                startPos: statement.range().end.index,
                endPos: statement.range().end.index,
                insertedText: `\n${newImportStatement}`,
            };
            edits.push(newEdit);
            tlsImportState.added = true;
        } else {
        }
    }

    return true;
}

function handleNamespaceImport(
    importOrDeclarator: SgNode,
    rootNode: SgNode,
    edits: Edit[],
    importType: ImportType,
    tlsImportState: { added: boolean; identifier: string },
) {
    const isEsm = importType === 'NAMESPACE_IMPORT';
    const nameNode = isEsm
        ? importOrDeclarator.find({ rule: { kind: 'namespace_import' } })?.find({ rule: { kind: 'identifier' }})
        : importOrDeclarator.field('name');

    if (!nameNode) {
        return false;
    }
    const namespaceName = nameNode.text();

    const memberAccessFindRule = {
        rule: {
            kind: 'member_expression',
            all: [
                { has: { field: 'object', regex: `^${namespaceName}$` } },
                { has: { field: 'property', regex: '^createCredentials$' } },
            ],
        },
    };
    const memberAccessUsages = rootNode.findAll(memberAccessFindRule);

    if (memberAccessUsages.length > 0) {

        const allUsagesFindRule = {
            rule: {
                kind: 'member_expression',
                has: { field: 'object', regex: `^${namespaceName}$` },
            },
        };
        const allUsages = rootNode.findAll(allUsagesFindRule);

        if (allUsages.length === memberAccessUsages.length) {
            const newTlsIdentifier = tlsImportState.identifier;
            const newImportModule = 'node:tls';
            const newImportStatement = isEsm
                ? `import * as ${newTlsIdentifier} from '${newImportModule}';`
                : `const ${newTlsIdentifier} = require('${newImportModule}');`;

            const nodeToReplace = isEsm
                ? importOrDeclarator
                : importOrDeclarator.parent();
            edits.push(nodeToReplace.replace(newImportStatement));
            tlsImportState.added = true;

            for (const usage of memberAccessUsages) {
                const replacementText = `${newTlsIdentifier}.createSecureContext`;
                edits.push(usage.replace(replacementText));
            }
        } else {
            let tlsIdentifier = ensureTlsImport(
                rootNode,
                edits,
                importType,
                tlsImportState,
            );

            for (const usage of memberAccessUsages) {
                const replacementText = `${tlsIdentifier}.createSecureContext`;
                edits.push(usage.replace(replacementText));
            }
        }
        return true;
    } else {
        return false;
    }
}

export default function transform(root: SgRoot): string | null {
    const edits: Edit[] = [];
    const rootNode = root.root();
    let wasTransformed = false;
    const tlsImportState = { added: false, identifier: 'tls' };

    const cryptoImportsRule = {
        rule: {
            any: [
                {
                    kind: 'variable_declarator',
                    has: {
                        field: 'value',
                        kind: 'call_expression',
                        has: {
                            field: 'arguments',
                            has: { regex: "^['\"](node:)?crypto['\"]$" },
                        },
                    },
                },
                {
                    kind: 'import_statement',
                    has: { field: 'source', regex: "^['\"](node:)?crypto['\"]$" },
                },
            ],
        },
    };
    const cryptoImports = rootNode.findAll(cryptoImportsRule);

    for (const importMatch of cryptoImports) {
        const nameNode = importMatch.field('imports') ?? importMatch.field('name');
        let importType: ImportType | undefined;

        if (importMatch.kind() === 'import_statement') {
            if (importMatch.find({ rule: { kind: 'namespace_import' } })) {
                importType = 'NAMESPACE_IMPORT';
            } else {
                importType = 'DESTRUCTURED_IMPORT';
            }
        } else {
            // variable_declarator for require
            if (nameNode?.is('object_pattern')) {
                importType = 'DESTRUCTURED_REQUIRE';
            } else if (nameNode?.is('identifier')) {
                importType = 'NAMESPACE_REQUIRE';
            }
        }

        if (importType === undefined) {
            continue;
        }

        let transformedByType = false;
        switch (importType) {
            case 'DESTRUCTURED_REQUIRE':
            case 'DESTRUCTURED_IMPORT':
                const statement =
                    importType === 'DESTRUCTURED_REQUIRE'
                        ? importMatch.parent()
                        : importMatch;
                transformedByType = handleDestructuredImport(
                    statement,
                    rootNode,
                    edits,
                    tlsImportState,
                );
                break;

            case 'NAMESPACE_REQUIRE':
            case 'NAMESPACE_IMPORT':
                transformedByType = handleNamespaceImport(
                    importMatch,
                    rootNode,
                    edits,
                    importType,
                    tlsImportState,
                );
                break;
        }

        if (transformedByType) {
            wasTransformed = true;
        }
    }

    if (wasTransformed) {
        return rootNode.commitEdits(edits);
    } else {
        return null;
    }
}
