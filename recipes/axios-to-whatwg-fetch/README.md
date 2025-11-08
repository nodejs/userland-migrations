# Axios to WHATWG Fetch Codemod

## Description

This codemod transforms code using Axios to leverage the WHATWG Fetch API, which is now natively available in Node.js. By replacing Axios with Fetch, you can reduce dependencies, mitigate risks, and improve performance.

## Supported Transformations

The codemod supports the following Axios methods and converts them to their Fetch equivalents:

- `axios.request(config)`
- `axios.get(url[, config])`
- `axios.delete(url[, config])`
- `axios.head(url[, config])`
- `axios.options(url[, config])`
- `axios.post(url[, data[, config]])`
- `axios.put(url[, data[, config]])`
- `axios.patch(url[, data[, config]])`

### Examples

#### GET Request

```diff
 const base = 'https://dummyjson.com/todos';

- const all = await axios.get(base);
+ const all = await fetch(base).then(async (res) => Object.assign(res, { data: await res.json() })).catch(() => null);
	console.log('\nGET /todos ->', all.status);
	console.log(`Preview: ${all.data.todos.length} todos`);
```

#### POST Request

```diff
 const base = 'https://dummyjson.com/todos';

- const created = await axios.post(
-     `${base}/add`, {
-         todo: 'Use DummyJSON in the project',
-         completed: false,
-         userId: 5,
-     }, {
-         headers: { 'Content-Type': 'application/json' }
-     }
- );
+ const created = await fetch(`${base}/add`, {
+     method: 'POST',
+     headers: { 'Content-Type': 'application/json' },
+     body: JSON.stringify({
+         todo: 'Use DummyJSON in the project',
+         completed: false,
+         userId: 5,
+     }),
+ }).then(async (res) => Object.assign(res, { data: await res.json() }));
	console.log('\nPOST /todos/add ->', created.status);
	console.log('Preview:', created.data?.id ? `created id ${created.data.id}` : JSON.stringify(created.data).slice(0,200));
```

#### PUT Request

```diff
 const base = 'https://dummyjson.com/todos';

- const updatedPut = await axios.put(
-     `${base}/1`,
-     { completed: false },
-     { headers: { 'Content-Type': 'application/json' } }
- );
+ const updatedPut = await fetch(`${base}/1`, {
+     method: 'PUT',
+     headers: { 'Content-Type': 'application/json' },
+     body: JSON.stringify({ completed: false }),
+ }).then(async (res) => Object.assign(res, { data: await res.json() }));
	console.log('\nPUT /todos/1 ->', updatedPut.status);
	console.log('Preview:', updatedPut.data?.completed !== undefined ? `completed=${updatedPut.data.completed}` : JSON.stringify(updatedPut.data).slice(0,200));
```

#### DELETE Request

```diff
 const base = 'https://dummyjson.com/todos';

- const deleted = await axios.delete(`${base}/1`);
+ const deleted = await fetch(`${base}/1`, { method: 'DELETE' })
+ .then(async (res) => Object.assign(res, { data: await res.json() }));
	console.log('\nDELETE /todos/1 ->', deleted.status);
	console.log('Preview:', deleted.data ? JSON.stringify(deleted.data).slice(0,200) : typeof deleted.data);
```

## Unsupported APIs

The following Axios methods are not supported by this codemod and will generate warnings:

- `axios.postForm(url[, data[, config]])`
- `axios.putForm(url[, data[, config]])`
- `axios.patchForm(url[, data[, config]])`

## References

- [Fetch Spec](https://fetch.spec.whatwg.org)
- [Axios Documentation](https://axios-http.com)
- [Node.js Documentation](https://nodejs.org/docs/latest/api/globals.html#fetch)

