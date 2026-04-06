---
authors: AugustinMauroy
---

# import assert import with

Converts the deprecated import assertion syntax (`assert { type: 'json' }`) to the standardized import attribute syntax (`with { type: 'json' }`) for both static and dynamic imports.

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/import-assertions-to-attributes
```

## Examples

### Example 1

Static and dynamic imports:

```diff
-import data from './data.json' assert { type: 'json' };
+import data from './data.json' with { type: 'json' };

 const data2 = await import('./data2.json', {
-  assert: { type: 'json' },
+  with: { type: 'json' },
 });

 await import('./data3.json', {
-  assert: { type: 'json' },
+  with: { type: 'json' },
 });

 function getData4() {
   return import('./data4.json', {
-    assert: { type: 'json' },
+    with: { type: 'json' },
   });
 }
```

### Example 2

Edge cases including compact syntax and semicolons in paths:

```diff
-import data from './data.json' assert { type: 'json' };
+import data from './data.json' with { type: 'json' };
-import systemOfADown from './system;of;a;down.json' assert { type: 'json' };
+import systemOfADown from './system;of;a;down.json' with { type: 'json' };
-import { default as config } from './config.json'assert{type: 'json'};
+import { default as config } from './config.json'with{type: 'json'};
-import { thing } from "./data.json"assert{type: 'json'};
+import { thing } from "./data.json"with{type: 'json'};

 const data2 = await import('./data2.json', {
-  assert: { type: 'json' },
+  with: { type: 'json' },
 });
```
