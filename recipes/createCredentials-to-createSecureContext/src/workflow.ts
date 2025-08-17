import { EOL } from 'node:os';
import type { SgRoot, Edit, SgNode, Kinds, TypesMap } from "@codemod.com/jssg-types/main";
import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";
import { getNodeImportCalls, getNodeImportStatements } from "@nodejs/codemod-utils/ast-grep/import-statement";

const newImportFunction = 'createSecureContext'
const newImportModule = 'node:tls'
const oldFunctionName = 'createCredentials';
const oldImportModule = 'node:crypto'
const newNamespace = 'tls';

function handleNamespaceImport(
    rootNode: SgRoot,
    localNamespace: string,
    declaration: SgNode<TypesMap, Kinds<TypesMap>>,
    importType: 'require' | 'static' | 'dynamic-await'
): Edit[] {
    const usages = rootNode.root().findAll({
        rule: {
            kind: 'call_expression',
            has: {
                field: 'function',
                kind: 'member_expression',
                all: [
                    { has: { field: 'object', regex: `^${localNamespace}$` } },
                    { has: { field: 'property', regex: `^${oldFunctionName}$` } }
                ]
            }
        }
    });

    if (usages.length === 0) return [];

    const usageEdits = usages
        .map(usage => usage.field('function'))
        .filter((func): func is SgNode<TypesMap, Kinds<TypesMap>> => Boolean(func))
        .map(func => func.replace(`${newNamespace}.${newImportFunction}`));

    switch (importType) {
        case 'require':
            return [...usageEdits, declaration.replace(`const ${newNamespace} = require('${newImportModule}');`)];
        case 'static':
            return [...usageEdits, declaration.replace(`import * as ${newNamespace} from '${newImportModule}';`)];
        case 'dynamic-await':
            return [...usageEdits, declaration.replace(`const ${newNamespace} = await import('${newImportModule}');`)];
    }
}

function handleDestructuredImport(
    rootNode: SgRoot,
    idNode: SgNode<TypesMap, Kinds<TypesMap>>,
    declaration: SgNode<TypesMap, Kinds<TypesMap>>,
    importType: 'require' | 'static' | 'dynamic-await'
): Edit[] {
    let localFunctionName: string | null = null;
    let targetSpecifierNode: SgNode | null = null;
    let isAliased = false;

    const relevantSpecifiers = idNode.children().filter(
        child => child.kind() === 'pair_pattern'
            || child.kind() === 'shorthand_property_identifier_pattern'
            || child.kind() === 'import_specifier'
    );

    for (const spec of relevantSpecifiers) {
        let keyNode: SgNode<TypesMap, Kinds<TypesMap>> | null = null;
		let aliasNode: SgNode<TypesMap, Kinds<TypesMap>> | null = null;

        if (spec.kind() === 'import_specifier') {
            keyNode = spec.field('name');
            aliasNode = spec.field('alias');
        } else if (spec.kind() === 'pair_pattern') {
            keyNode = spec.field('key');
            aliasNode = spec.field('value');
        } else {
            keyNode = spec;
        }

        if (keyNode?.text() === oldFunctionName) {
            targetSpecifierNode = spec;
            isAliased = Boolean(aliasNode);
            localFunctionName = isAliased ? aliasNode!.text() : keyNode!.text();
            break;
        }
    }

    if (localFunctionName && targetSpecifierNode) {
        const allEdits: Edit[] = [];

        if (!isAliased) {
            allEdits.push(...findAndReplaceUsages(rootNode, localFunctionName, newImportFunction));
        }

        const aliasSeparator = importType === 'static' ? ' as' : ':';
        const newImportSpecifier = isAliased
            ? `{ ${newImportFunction}${aliasSeparator} ${localFunctionName} }`
            : `{ ${newImportFunction} }`;

        let newImportStatement = '';
        switch (importType) {
            case 'require':
                newImportStatement = `const ${newImportSpecifier} = require('${newImportModule}');`;
                break;
            case 'static':
                newImportStatement = `import ${newImportSpecifier} from '${newImportModule}';`;
                break;
            case 'dynamic-await':
                newImportStatement = `const ${newImportSpecifier} = await import('${newImportModule}');`;
                break;
        }

        const otherSpecifiers = relevantSpecifiers.filter(s => s !== targetSpecifierNode);
        if (otherSpecifiers.length > 0) {
            let modifiedOldImport = '';
            const otherSpecifiersText = otherSpecifiers.map(s => s.text()).join(', ');
            switch (importType) {
                case 'require':
                    modifiedOldImport = `const { ${otherSpecifiersText} } = require('${oldImportModule}');`;
                    break;
                case 'static':
                    modifiedOldImport = `import { ${otherSpecifiersText} } from '${oldImportModule}';`;
                    break;
                case 'dynamic-await':
                    modifiedOldImport = `const { ${otherSpecifiersText} } = await import('${oldImportModule}');`;
                    break;
            }
            allEdits.push(declaration.replace(`${modifiedOldImport}${EOL}${newImportStatement}`));
        } else {
            allEdits.push(declaration.replace(newImportStatement));
        }

        return allEdits;
    }

    return [];
}
function findAndReplaceUsages(
    rootNode: SgRoot,
    localFunctionName: string,
    newFunctionName: string,
    object: string | null = null
): Edit[] {
    const functionRule = object
        ? {
            field: 'function',
            kind: 'member_expression',
            all: [
                { has: { field: 'object', regex: `^${object}$` } },
                { has: { field: 'property', regex: `^${localFunctionName}$` } }
            ]
          }
        : {
            field: 'function',
            kind: 'identifier',
            regex: `^${localFunctionName}$`
          };

    const usages = rootNode.root().findAll({
        rule: {
            kind: 'call_expression',
            has: functionRule
        }
    });

    return usages
        .map(usage => {
            const functionNode = usage.field('function');
            if (!functionNode) return null;

            const nodeToReplace = object ? functionNode.field('property') : functionNode;
            return nodeToReplace ? nodeToReplace.replace(newFunctionName) : null;
        })
        .filter((edit): edit is Edit => Boolean(edit));
}

function handleRequire(
  statement: SgNode<TypesMap, Kinds<TypesMap>>,
  rootNode: SgRoot,
): Edit[] {
  const idNode = statement.child(0);
  const declaration = statement.parent();
  if (!idNode || !declaration) return [];

  if (idNode.kind() === 'identifier')
    return handleNamespaceImport(rootNode, idNode.text(), declaration, 'require');

  if (idNode.kind() === 'object_pattern')
    return handleDestructuredImport(rootNode, idNode, declaration, 'require');

  return [];
}

function handleStaticImport(
  statement: SgNode<TypesMap, Kinds<TypesMap>>,
  rootNode: SgRoot
): Edit[] {
  const importClause = statement.child(1);
  if (importClause?.kind() !== 'import_clause') return [];

  const content = importClause.child(0);
  if (!content) return [];

  // Namespace imports: import * as ns from '...'
  if (content.kind() === 'namespace_import') {
    const ns = content.find({ rule: { kind: 'identifier' } })?.text();
    if (!ns) return [];

    const usages = rootNode.root().findAll({
      rule: {
        kind: 'call_expression',
        has: {
          field: 'function',
          kind: 'member_expression',
          all: [
            { has: { field: 'object', regex: `^${ns}$` } },
            { has: { field: 'property', regex: `^${oldFunctionName}$` } }
          ]
        }
      }
    });
    if (!usages.length) return [];

    const edits = usages
      .map(u => u.field('function')?.replace(`${newNamespace}.${newImportFunction}`))
      .filter(Boolean);
    edits.push(statement.replace(`import * as ${newNamespace} from '${newImportModule}';`));
    return edits as Edit[];
  }

  // Named imports: import { x } from '...'
  if (content.kind() === 'named_imports') {
    const specs = content.children().filter(c => c.kind() === 'import_specifier');
    const target = specs.find(s => s.field('name')?.text() === oldFunctionName);
    if (!target) return [];

    const aliasNode = target.field('alias');
    const localName = aliasNode?.text() || target.field('name')?.text() || "";
    const edits = aliasNode ? [] : findAndReplaceUsages(rootNode, localName, newImportFunction);

    const newSpec = aliasNode ? `{ ${newImportFunction} as ${localName} }` : `{ ${newImportFunction} }`;
    const newStmt = `import ${newSpec} from '${newImportModule}';`;
    const others = specs.filter(s => s !== target);

    return [
      ...edits,
      others.length
        ? statement.replace(
            `import { ${others.map(s => s.text()).join(', ')} } from '${oldImportModule}';${EOL}${newStmt}`
          )
        : statement.replace(newStmt)
    ];
  }

  return [];
}


function handleDynamicImport(
  statement: SgNode<TypesMap, Kinds<TypesMap>>,
  rootNode: SgRoot,
): Edit[] {
  const valueNode = statement.field('value');
  const idNode = statement.child(0);
  const declaration = statement.parent();

  // must be `const ... = await import(...)` and have a parent declaration
  if (valueNode?.kind() !== 'await_expression' || !declaration) return [];

  // Case 1: `const ns = await import(...)`
  if (idNode?.kind() === 'identifier') {
    const localNamespace = idNode.text();
    if (!localNamespace) return [];

    const usages = rootNode.root().findAll({
      rule: {
        kind: 'call_expression',
        has: {
          field: 'function',
          kind: 'member_expression',
          all: [
            { has: { field: 'object', regex: `^${localNamespace}$` } },
            { has: { field: 'property', regex: `^${oldFunctionName}$` } }
          ]
        }
      }
    });

    if (!usages.length) return [];

    const edits = usages
      .map(u => u.field('function')?.replace(`${newNamespace}.${newImportFunction}`))
      .filter(Boolean) as Edit[];

    edits.push(declaration.replace(`const ${newNamespace} = await import('${newImportModule}');`));
    return edits;
  }

  // Case 2: `const { ... } = await import(...)`
  if (idNode?.kind() === 'object_pattern') {
    const specifiers = idNode.children().filter(
      c => c.kind() === 'pair_pattern' || c.kind() === 'shorthand_property_identifier_pattern'
    );

    let targetSpecifier: SgNode | null = null;
    let localFunctionName: string | null | undefined = null;
    let isAliased = false;

    for (const spec of specifiers) {
      const keyNode = spec.kind() === 'pair_pattern' ? spec.field('key') : spec;
      if (keyNode?.text() === oldFunctionName) {
        targetSpecifier = spec;
        isAliased = spec.kind() === 'pair_pattern';
        localFunctionName = isAliased ? spec.field('value')?.text() : keyNode.text();
        break;
      }
    }

    if (!localFunctionName || !targetSpecifier) return [];

    const edits: Edit[] = [];
    if (!isAliased) edits.push(...findAndReplaceUsages(rootNode, localFunctionName, newImportFunction));

    const newImportSpecifier = isAliased
      ? `{ ${newImportFunction}: ${localFunctionName} }`
      : `{ ${newImportFunction} }`;

    const newImportStmt = `const ${newImportSpecifier} = await import('${newImportModule}');`;

    const otherSpecifiers = specifiers.filter(s => s !== targetSpecifier);
    if (otherSpecifiers.length) {
      const remaining = `const { ${otherSpecifiers.map(s => s.text()).join(', ')} } = await import('${oldImportModule}');`;
      edits.push(declaration.replace(`${remaining}${EOL}${newImportStmt}`));
    } else {
      edits.push(declaration.replace(newImportStmt));
    }

    return edits;
  }

  return [];
}

export default function transform(root: SgRoot): string | null {
  const rootNode = root.root();
  const allEdits: Edit[] = [];
  const sources: [SgNode[] | undefined, (n: SgNode, r: SgRoot) => Edit[]][] = [
    // @ts-ignore
    [getNodeRequireCalls(root, 'crypto'), handleRequire],
    // @ts-ignore
    [getNodeImportStatements(root, 'crypto'), handleStaticImport],
    // @ts-ignore
    [getNodeImportCalls(root, 'crypto'), handleDynamicImport],
  ];

  for (const [nodes, handler] of sources) {
    for (const node of nodes || []) {
      const edits = handler(node, root);
      if (edits.length) {
        allEdits.push(...edits);
      }
    }
  }

  if (!allEdits.length) return null;

	return rootNode.commitEdits(allEdits);
}
