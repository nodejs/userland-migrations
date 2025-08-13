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

const newImportModule = 'node:tls';
const newImportFunction = 'createSecureContext';

function getImportHelpers(importType: ImportType) {
    const isEsm =
        importType === 'DESTRUCTURED_IMPORT' || importType === 'NAMESPACE_IMPORT';

    return {
        isEsm,
        createNamespaceImport: (id: string, mod: string) =>
            isEsm
                ? `import * as ${id} from '${mod}'`
                : `const ${id} = require('${mod}')`,
        createDestructuredImport: (specifier: string, mod: string) =>
            isEsm
                ? `import { ${specifier} } from '${mod}'`
                : `const { ${specifier} } = require('${mod}')`,
        getStatementNode: (match: SgNode): SgNode | null =>
            isEsm ? match : match.parent(),
    };
}


function ensureTlsImport(
    rootNode: SgNode,
    importType: ImportType,
    currentState: TlsImportState,
): EnsureTlsResult {
    if (currentState.added) {
        return { edits: [], identifier: currentState.identifier, newState: currentState };
    }

    const helpers = getImportHelpers(importType);
    const findRule = {
        rule: {
            kind: helpers.isEsm ? 'import_statement' : 'variable_declarator',
            has: {
                field: helpers.isEsm ? 'source' : 'value',
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
                newState: { added: true, identifier: foundIdentifier },
            };
        }
    }

    const firstNode = rootNode.children()[0];
    if (!firstNode) {
        return { edits: [], identifier: currentState.identifier, newState: currentState };
    }

    const tlsIdentifier = currentState.identifier;
    const newImportText = `${helpers.createNamespaceImport(tlsIdentifier, 'node:tls')};${os.EOL}`;
    const edit: Edit = {
        startPos: firstNode.range().start.index,
        endPos: firstNode.range().start.index,
        insertedText: newImportText,
    };

    return {
        edits: [edit],
        identifier: tlsIdentifier,
        newState: { added: true, identifier: tlsIdentifier },
    };
}

function handleDestructuredImport(
    statement: SgNode,
    rootNode: SgNode,
    currentState: TlsImportState,
    importType: ImportType,
): HandlerResult {
    const localEdits: Edit[] = [];
    const helpers = getImportHelpers(importType);

    const specifiersNode = helpers.isEsm
        ? statement.find({ rule: { kind: 'named_imports' } }) ?? statement.field('imports')
        : statement.find({ rule: { kind: 'variable_declarator' } })?.field('name');

    if (!specifiersNode) {
        return { edits: [], wasTransformed: false, newState: currentState };
    }

    const destructuredProps = specifiersNode.findAll({ rule: { any: [{ kind: 'shorthand_property_identifier_pattern' }, { kind: 'import_specifier' }]}});
    const createCredentialsNode = destructuredProps.find((id) => id.text() === 'createCredentials');

    if (!createCredentialsNode) {
        return { edits: [], wasTransformed: false, newState: currentState };
    }

    const usages = rootNode.findAll({ rule: { kind: 'call_expression', has: { field: 'function', kind: 'identifier', regex: '^createCredentials$' }}});
    for (const usage of usages) {
        usage.field('function')?.replace('createSecureContext');
    }

    const newImportStatement = `${helpers.createDestructuredImport(newImportFunction, newImportModule)};`;
    let finalState = currentState;

    if (destructuredProps.length === 1) {
        localEdits.push(statement.replace(newImportStatement));
        finalState = { ...currentState, added: true };
    } else {
        const otherProps = destructuredProps
            .map(d => d.text())
            .filter(text => text !== 'createCredentials');

        localEdits.push(specifiersNode.replace(`{ ${otherProps.join(', ')} }`));

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

    return { edits: localEdits, wasTransformed: true, newState: finalState };
}

function handleNamespaceImport(
    importOrDeclarator: SgNode,
    rootNode: SgNode,
    importType: ImportType,
    currentState: TlsImportState,
): HandlerResult {
    const localEdits: Edit[] = [];
    const helpers = getImportHelpers(importType);

    const nameNode = helpers.isEsm
        ? importOrDeclarator.find({ rule: { kind: 'namespace_import' } })?.find({ rule: { kind: 'identifier' } })
        : importOrDeclarator.field('name');

    if (!nameNode) {
        return { edits: [], wasTransformed: false, newState: currentState };
    }
    const namespaceName = nameNode.text();

    const memberAccessUsages = rootNode.findAll({ rule: { kind: 'member_expression', all: [ { has: { field: 'object', regex: `^${namespaceName}$` } }, { has: { field: 'property', regex: '^createCredentials$' } }]}});
    if (memberAccessUsages.length === 0) {
        return { edits: [], wasTransformed: false, newState: currentState };
    }

    const allUsages = rootNode.findAll({ rule: { kind: 'member_expression', has: { field: 'object', regex: `^${namespaceName}$` }}});
    let finalState = currentState;

    if (allUsages.length === memberAccessUsages.length) {
        const newTlsIdentifier = currentState.identifier;
        const newImportStatement = `${helpers.createNamespaceImport(newTlsIdentifier, newImportModule)};`;
        const nodeToReplace = helpers.getStatementNode(importOrDeclarator);

        if (nodeToReplace) {
            localEdits.push(nodeToReplace.replace(newImportStatement));
        }
        finalState = { ...currentState, added: true };
        for (const usage of memberAccessUsages) {
            localEdits.push(usage.replace(`${newTlsIdentifier}.createSecureContext`));
        }
    } else {
        const ensureResult = ensureTlsImport(rootNode, importType, currentState);
        localEdits.push(...ensureResult.edits);
        finalState = ensureResult.newState;
        for (const usage of memberAccessUsages) {
            localEdits.push(usage.replace(`${ensureResult.identifier}.createSecureContext`));
        }
    }

    return { edits: localEdits, wasTransformed: true, newState: finalState };
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
                { kind: 'variable_declarator', has: { field: 'value', kind: 'call_expression', has: { field: 'arguments', has: { regex: "^['\"](node:)?crypto['\"]$" }}}},
                { kind: 'import_statement', has: { field: 'source', regex: "^['\"](node:)?crypto['\"]$" }},
            ],
        },
    };
    const cryptoImports = rootNode.findAll(cryptoImportsRule);

    for (const importMatch of cryptoImports) {
        const nameNode = importMatch.field('imports') ?? importMatch.field('name');
        let importType: ImportType | undefined;

        if (importMatch.kind() === 'import_statement') {
            importType = importMatch.find({ rule: { kind: 'namespace_import' } })
                ? 'NAMESPACE_IMPORT' : 'DESTRUCTURED_IMPORT';
        } else if (nameNode?.is('object_pattern')) {
            importType = 'DESTRUCTURED_REQUIRE';
        } else if (nameNode?.is('identifier')) {
            importType = 'NAMESPACE_REQUIRE';
        }

        if (importType === undefined) continue;

        let result: HandlerResult | undefined;
        const helpers = getImportHelpers(importType);

        switch (importType) {
            case 'DESTRUCTURED_REQUIRE':
            case 'DESTRUCTURED_IMPORT': {
                const statement = helpers.getStatementNode(importMatch);
                if (statement) {
                    result = handleDestructuredImport(statement, rootNode, currentTlsImportState, importType);
                }
                break;
            }
            case 'NAMESPACE_REQUIRE':
            case 'NAMESPACE_IMPORT':
                result = handleNamespaceImport(importMatch, rootNode, importType, currentTlsImportState);
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

    return wasTransformed ? rootNode.commitEdits(allEdits) : null;
}
