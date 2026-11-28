# @nodejs/tls-internal-modules-to-node-tls

Migrates legacy imports of internal Node.js TLS modules (`_tls_common`, `_tls_wrap`) to the public `node:tls` module as introduced under [DEP0192](https://nodejs.org/api/deprecations.html#dep0192-requirenode_tls_common-and-requirenode_tls_wrap).

## Supported Modules and Exports

- `_tls_common` / `node:_tls_common`: `SecureContext`, `createSecureContext`
- `_tls_wrap` / `node:_tls_wrap`: `TLSSocket`, `Server`, `createServer`, `connect`

## Behavior

- Replaces module specifiers with `node:tls` when accessing supported public exports.
- Supports ESM named imports, CommonJS destructuring, direct property access, dynamic imports, and re-exports.
- Preserves local aliases and handles TypeScript type annotations.
- Consolidates multiple imports targeting `node:tls`.
- Skips internal-only exports (e.g. `translatePeerCertificate`), escaped namespace objects, and unknown properties, reporting them for manual review.
