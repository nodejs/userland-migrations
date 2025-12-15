# `crypto.createCredentials` DEP0010

This recipe transforms `crypto.createCredentials` usage to use modern `node:tls` methods.

See [DEP0010](https://nodejs.org/api/deprecations.html#DEP0010).

## Examples

```diff
- // Using the deprecated createCredentials from node:crypto
- const { createCredentials } = require('node:crypto');
- // OR
- import { createCredentials } from 'node:crypto';
-
- const credentials = createCredentials({
-   key: privateKey,
-   cert: certificate,
-   ca: [caCertificate]
- });
-
+ // Updated to use createSecureContext from node:tls
+ const { createSecureContext } = require('node:tls');
+ // OR
+ import { createSecureContext } from 'node:tls';
+
+ const credentials = createSecureContext({
+   key: privateKey,
+   cert: certificate,
+   ca: [caCertificate]
+ });
+
`````
