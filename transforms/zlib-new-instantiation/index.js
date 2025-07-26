/**
 * Codemod: Add `new` to zlib class instantiations
 * Issue: https://github.com/nodejs/userland-migrations/issues/105
 */

const ZLIB_CLASSES = new Set([
  'Deflate', 'DeflateRaw', 'Gunzip', 'Gzip', 'Inflate', 'InflateRaw', 'Unzip',
  'BrotliCompress', 'BrotliDecompress', 'ZstdCompress', 'ZstdDecompress', 'Zlib',
]);

module.exports = function transformer(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  const zlibNamespaces = new Set();   // e.g., `zlib`
  const zlibDestructured = new Set(); // e.g., `Gzip`

  // Handle `require('zlib')`
  root.find(j.VariableDeclarator).forEach(path => {
    const { id, init } = path.node;
    if (
      init?.type === 'CallExpression' &&
      init.callee.name === 'require' &&
      ['zlib', 'node:zlib'].includes(init.arguments[0].value)
    ) {
      if (id.type === 'Identifier') {
        zlibNamespaces.add(id.name);
      } else if (id.type === 'ObjectPattern') {
        id.properties.forEach(p => {
          if (ZLIB_CLASSES.has(p.key.name)) {
            zlibDestructured.add(p.value.name);
          }
        });
      }
    }
  });

  // Handle `import ... from 'zlib'`
  root.find(j.ImportDeclaration).forEach(path => {
    if (!['zlib', 'node:zlib'].includes(path.node.source.value)) return;
    path.node.specifiers.forEach(spec => {
      if (spec.type === 'ImportNamespaceSpecifier') {
        zlibNamespaces.add(spec.local.name);
      } else if (spec.type === 'ImportSpecifier') {
        if (ZLIB_CLASSES.has(spec.imported.name)) {
          zlibDestructured.add(spec.local.name);
        }
      }
    });
  });

  // Transform plain calls to zlib classes into new expressions
  root.find(j.CallExpression).forEach(path => {
    const { callee } = path.node;

    if (callee.type === 'Identifier' && zlibDestructured.has(callee.name)) {
      j(path).replaceWith(
        j.newExpression(j.identifier(callee.name), path.node.arguments)
      );
    }

     if (
      callee.type === 'MemberExpression' &&
      callee.property.type === 'Identifier' &&
      ZLIB_CLASSES.has(callee.property.name) &&
      callee.object.type === 'Identifier' &&
      zlibNamespaces.has(callee.object.name)
    ) {
      j(path).replaceWith(
        j.newExpression(callee, path.node.arguments)
      );
    }
  });

  return root.toSource({ quote: 'single' });
};

