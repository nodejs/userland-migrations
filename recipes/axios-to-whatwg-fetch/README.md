---
authors: brunocroh, AugustinMauroy
---

# Axios to WHATWG Fetch

Migrates code from the [Axios](https://axios-http.com) HTTP client to the [WHATWG Fetch](https://fetch.spec.whatwg.org) API that is natively available in Node.js as the global [`fetch`](https://nodejs.org/docs/latest/api/globals.html#fetch), reducing dependencies and improving performance. It rewrites every Axios request helper — `axios.request()`, `axios.get()`, `axios.delete()`, `axios.head()`, `axios.options()`, `axios.post()`, `axios.put()`, `axios.patch()`, `axios.postForm()`, `axios.putForm()`, and `axios.patchForm()` — and recognizes default ESM imports, aliased imports, CommonJS `require()` calls, and dynamic `import()`. Once all call sites are converted, it also removes the `axios` and `@types/axios` entries from `package.json`.

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/axios-to-whatwg-fetch
```

## Examples

### GET request

A plain `axios.get()` becomes a `fetch()` call with a shim that keeps the `response.data` property working.

```diff
-import axios from "axios";
 const base = "https://dummyjson.com/todos";

-const all = await axios.get(base);
+const all = await fetch(base)
+  .then(async (res) => Object.assign(res, { data: await res.json() }))
+  .catch(() => null);
 console.log("\nGET /todos ->", all.status);
 console.log(`Preview: ${all.data.todos.length} todos`);
```

### POST request with a JSON body

The `data` argument of `axios.post()` is serialized with `JSON.stringify()` and passed as the `body` option.

```diff
-import axios from 'axios';
 const base = 'https://dummyjson.com/todos/add';

-const todoCreated = await axios.post(base, {
-  todo: 'Use DummyJSON in the project',
-  completed: false,
-  userId: 5,
-});
+const todoCreated = await fetch(base, {
+  method: "POST",
+  body: JSON.stringify({
+    todo: 'Use DummyJSON in the project',
+    completed: false,
+    userId: 5,
+  })
+})
+  .then(async (resp) => Object.assign(resp, { data: await resp.json() }))
+  .catch(() => null);
 console.log('\nPOST /todos ->', todoCreated);
```

### Form submission

`axios.postForm()` (and the `putForm`/`patchForm` variants) send the payload as `URLSearchParams`.

```diff
-import axios from 'axios';
 const base = 'https://dummyjson.com/forms';

-const created = await axios.postForm(`${base}/submit`, {
-    title: 'Form Demo',
-    completed: false,
-});
+const created = await fetch(`${base}/submit`, {
+  method: "POST",
+  body: new URLSearchParams({
+      title: 'Form Demo',
+      completed: false,
+  })
+})
+  .then(async (resp) => Object.assign(resp, { data: await resp.json() }))
+  .catch(() => null);
 console.log(created);
```

### `axios.request()` with a config object

The `url`, `method`, and `data` properties of the config object are mapped onto the `fetch()` call.

```diff
-import axios from 'axios';
-
 const base = 'https://dummyjson.com/todos/1';

-const customRequest = await axios.request({
-  url: base,
-  method: 'PATCH',
-  data: {
-    todo: 'Updated todo',
-    completed: true,
-  },
-});
+const customRequest = await fetch(base, {
+  method: "PATCH",
+  body: JSON.stringify({
+      todo: 'Updated todo',
+      completed: true,
+    })
+})
+  .then(async (resp) => Object.assign(resp, { data: await resp.json() }))
+  .catch(() => null);
 console.log('\nREQUEST /todos/1 ->', customRequest);
```

### CommonJS `require()`

CommonJS modules are handled the same way, and the now-unused `require('axios')` binding is removed.

```diff
-const axios = require('axios');

 function fetchAllTodos() {
-    return axios.get('https://dummyjson.com/todos');
+    return fetch('https://dummyjson.com/todos')
+  .then(async (res) => Object.assign(res, { data: await res.json() }))
+  .catch(() => null);
 }

 module.exports = { fetchAllTodos };
```

## Notes

- A `fetch` response exposes its payload through `res.json()` rather than a `data` property, so each converted call is followed by `.then(async (res) => Object.assign(res, { data: await res.json() }))` to keep existing `response.data` accesses working.
- Converted calls end with `.catch(() => null)`, so a failed request resolves to `null` instead of rejecting. Also note that unlike Axios, `fetch` does not reject on HTTP error statuses (4xx/5xx), so error-handling code built around Axios rejections should be reviewed manually.
- Safety first: if any Axios call in a file uses an unsupported configuration option, the entire file is left untouched and a warning with the source location is printed, preserving the original behavior.
- After the transformation, the codemod detects your package manager and removes the `axios` and `@types/axios` dependencies from `package.json`.

### Limitations

The codemod skips files whose Axios calls use any of the following configuration options, because they have no direct `fetch` equivalent:

- `beforeRedirect`
- `cancelToken`
- `decompress`
- `httpAgent`
- `httpsAgent`
- `maxBodyLength`
- `maxContentLength`
- `maxRedirects`
- `paramsSerializer`
- `signal`
- `socketPath`
- `timeout`
- `transformRequest`
- `transformResponse`
- `validateStatus`
- `withCredentials`

It also does not cover Axios features outside of the direct request helpers, such as interceptors, cancel tokens, or instance configuration created with `axios.create()`.

<!-- sync_to_learn: true -->
