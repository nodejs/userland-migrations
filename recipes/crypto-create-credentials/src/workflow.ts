import * as os from 'node:os';
import type { SgRoot, Edit, SgNode } from "@codemod.com/jssg-types/main";

type TlsImportState = {
    added: boolean;
    identifier: string;
};

type HandlerResult = {
    edits: Edit[];
    wasTransformed: boolean;
    newState: TlsImportState;
};

type EnsureTlsResult = {
    edits: Edit[];
    identifier: string; // The identifier that was used or found
    newState: TlsImportState;
};

type ImportType =
    | 'DESTRUCTURED_REQUIRE'
    | 'NAMESPACE_REQUIRE'
    | 'DESTRUCTURED_IMPORT'
    | 'NAMESPACE_IMPORT';

function ensureTlsImport(
    rootNode: SgNode,
    importType: ImportType,
    currentState: TlsImportState,
): EnsureTlsResult {
    if (currentState.added) {
        return {
            edits: [],
            identifier: currentState.identifier,
            newState: currentState,
        };
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
            const foundIdentifier = nameNode.text();
            return {
                edits: [],
                identifier: foundIdentifier,
                newState: {
                    added: true,
                    identifier: foundIdentifier,
                },
            };
        }
    }

    const firstNode = rootNode.children()[0];

    if (!firstNode) {
        return {
            edits: [],
            identifier: currentState.identifier,
            newState: currentState,
        };
    }

    const tlsIdentifier = currentState.identifier;
    const newImportText = isEsm
        ? `import * as ${tlsIdentifier} from '${moduleSpecifier}';${os.EOL}`
        : `const ${tlsIdentifier} = require('${moduleSpecifier}');${os.EOL}`;

    const edit: Edit = {
        startPos: firstNode.range().start.index,
        endPos: firstNode.range().start.index,
        insertedText: newImportText,
    };

    return {
        edits: [edit],
        identifier: tlsIdentifier,
        newState: {
            added: true,
            identifier: tlsIdentifier,
        },
    };
}

function handleDestructuredImport(
    statement: SgNode,
    rootNode: SgNode,
    currentState: TlsImportState,
): HandlerResult {
    const localEdits: Edit[] = [];
    const isEsm = statement.kind() === 'import_statement';

    let specifiersNode: SgNode | null | undefined;
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
        return { edits: [], wasTransformed: false, newState: currentState };
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
        return { edits: [], wasTransformed: false, newState: currentState };
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
            localEdits.push(functionIdentifier.replace('createSecureContext'));
        }
    }

    const newImportModule = 'node:tls';
    const newImportFunction = 'createSecureContext';
    const newImportStatement = isEsm
        ? `import { ${newImportFunction} } from '${newImportModule}';`
        : `const { ${newImportFunction} } = require('${newImportModule}');`;

    let finalState = currentState;

    if (destructuredProps.length === 1) {
        localEdits.push(statement.replace(newImportStatement));
        finalState = { ...currentState, added: true };
    } else {
        const otherProps = [];
        for (const d of destructuredProps) {
          const text = d.text();
          if (text !== 'createCredentials') otherProps.push(text);
        }

        const newDestructuredString = `{ ${otherProps.join(', ')} }`;
        localEdits.push(specifiersNode.replace(newDestructuredString));

        if (!currentState.added) {
            const newEdit = {
                startPos: statement.range().end.index,
                endPos: statement.range().end.index,
                insertedText: `${os.EOL}${newImportStatement}`,
            };
            localEdits.push(newEdit);
            finalState = { ...currentState, added: true };
        }
    }

    return {
        edits: localEdits,
        wasTransformed: true,
        newState: finalState,
    };
}

function handleNamespaceImport(
    importOrDeclarator: SgNode,
    rootNode: SgNode,
    importType: ImportType,
    currentState: TlsImportState,
): HandlerResult {
    const localEdits: Edit[] = [];
    const isEsm = importType === 'NAMESPACE_IMPORT';

    const nameNode = isEsm
        ? importOrDeclarator.find({ rule: { kind: 'namespace_import' } })?.find({ rule: { kind: 'identifier' } })
        : importOrDeclarator.field('name');

    if (!nameNode) {
        return { edits: [], wasTransformed: false, newState: currentState };
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

    if (memberAccessUsages.length === 0) {
        return { edits: [], wasTransformed: false, newState: currentState };
    }

    const allUsagesFindRule = {
        rule: {
            kind: 'member_expression',
            has: { field: 'object', regex: `^${namespaceName}$` },
        },
    };
    const allUsages = rootNode.findAll(allUsagesFindRule);

    let finalState = currentState;

    if (allUsages.length === memberAccessUsages.length) {
        const newTlsIdentifier = currentState.identifier;
        const newImportModule = 'node:tls';
        const newImportStatement = isEsm
            ? `import * as ${newTlsIdentifier} from '${newImportModule}';`
            : `const ${newTlsIdentifier} = require('${newImportModule}');`;

        const nodeToReplace = isEsm
            ? importOrDeclarator
            : importOrDeclarator.parent();

        if (nodeToReplace) {
            localEdits.push(nodeToReplace.replace(newImportStatement));
        }

        finalState = { ...currentState, added: true };

        for (const usage of memberAccessUsages) {
            const replacementText = `${newTlsIdentifier}.createSecureContext`;
            localEdits.push(usage.replace(replacementText));
        }
    } else {
        const ensureResult = ensureTlsImport(
            rootNode,
            importType,
            currentState,
        );
        localEdits.push(...ensureResult.edits);
        finalState = ensureResult.newState;

        for (const usage of memberAccessUsages) {
            const replacementText = `${ensureResult.identifier}.createSecureContext`;
            localEdits.push(usage.replace(replacementText));
        }
    }

    return {
        edits: localEdits,
        wasTransformed: true,
        newState: finalState,
    };
}

export default function transform(root: SgRoot): string | null {
    const rootNode = root.root();
    const allEdits: Edit[] = [];
    let wasTransformed = false;
    let currentTlsImportState: TlsImportState = {
        added: false,
        identifier: 'tls',
    };

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
                    has: {
                        field: 'source',
                        regex: "^['\"](node:)?crypto['\"]$",
                    },
                },
            ],
        },
    };
    const cryptoImports = rootNode.findAll(cryptoImportsRule);

    for (const importMatch of cryptoImports) {
        const nameNode =
            importMatch.field('imports') ?? importMatch.field('name');
        let importType: ImportType | undefined;

        if (importMatch.kind() === 'import_statement') {
            if (importMatch.find({ rule: { kind: 'namespace_import' } })) {
                importType = 'NAMESPACE_IMPORT';
            } else {
                importType = 'DESTRUCTURED_IMPORT';
            }
        } else {
            if (nameNode?.is('object_pattern')) {
                importType = 'DESTRUCTURED_REQUIRE';
            } else if (nameNode?.is('identifier')) {
                importType = 'NAMESPACE_REQUIRE';
            }
        }

        if (importType === undefined) {
            continue;
        }

        let result: HandlerResult | undefined;

        switch (importType) {
            case 'DESTRUCTURED_REQUIRE':
            case 'DESTRUCTURED_IMPORT': {
                const statement =
                    importType === 'DESTRUCTURED_REQUIRE'
                        ? importMatch.parent()
                        : importMatch;
                if (statement) {
                    result = handleDestructuredImport(
                        statement,
                        rootNode,
                        currentTlsImportState,
                    );
                }
                break;
            }

            case 'NAMESPACE_REQUIRE':
            case 'NAMESPACE_IMPORT':
                result = handleNamespaceImport(
                    importMatch,
                    rootNode,
                    importType,
                    currentTlsImportState,
                );
                break;
        }

        if (result) {
            allEdits.push(...result.edits);
            currentTlsImportState = result.newState;
            if (result.wasTransformed) {
                wasTransformed = true;
            }
        }
    }

    if (wasTransformed) {
        return rootNode.commitEdits(allEdits);
    }

    return null;
}
