# @nodejs/http-internal-modules-to-node-http

Migrates legacy imports of internal Node.js HTTP modules (`_http_*`) to the public `node:http` module as introduced under [DEP0199](https://nodejs.org/api/deprecations.html#dep0199-requirenode_http_).

## Supported Modules and Exports

- `_http_agent` / `node:_http_agent`: `Agent`, `globalAgent`
- `_http_client` / `node:_http_client`: `ClientRequest`
- `_http_incoming` / `node:_http_incoming`: `IncomingMessage`
- `_http_outgoing` / `node:_http_outgoing`: `OutgoingMessage`, `validateHeaderName`, `validateHeaderValue`
- `_http_server` / `node:_http_server`: `Server`, `ServerResponse`, `STATUS_CODES`

## Behavior

- Replaces module specifiers with `node:http` when accessing supported public exports.
- Supports ESM named imports, CommonJS destructuring, direct property access, dynamic imports, and re-exports.
- Preserves local aliases and handles TypeScript type annotations.
- Consolidates multiple imports targeting `node:http`.
- Skips internal-only exports (e.g. `_http_common`), escaped namespace objects, and unknown properties, reporting them for manual review.
