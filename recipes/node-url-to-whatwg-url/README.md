# Node.js URL to WHATWG URL

This recipe converts Node.js `url` module usage to the WHATWG URL API. It modifies code that uses the legacy `url` module to use the modern `URL` class instead.

See [DEP0116](https://nodejs.org/api/deprecations.html#DEP0116).

## Example

### `url.parse` to `new URL()`

**Before:**
```js
const url = require('node:url');

const myUrl = new url.URL('https://example.com');
const urlAuth = legacyURL.auth;
```

**After:**
```js
const myUrl = new URL('https://example.com');
const urlAuth = `${myUrl.username}:${myUrl.password}`;
```

### `url.format` to `myUrl.toString()

**Before:**
```js
const url = require('node:url');

url.format({
  protocol: 'https',
  hostname: 'example.com',
  pathname: '/some/path',
  query: {
    page: 1,
    format: 'json',
  },
});
```

**After:**
```js
const myUrl = new URL('https://example.com/some/path?page=1&format=json').toString();
```

## Caveats

The [`url.resolve`](https://nodejs.org/api/url.html#urlresolvefrom-to) method is not directly translatable to the WHATWG URL API. You may need to implement custom logic to handle URL resolution in your application.

```js
function resolve(from, to) {
  const resolvedUrl = new URL(to, new URL(from, 'resolve://'));
  if (resolvedUrl.protocol === 'resolve:') {
    // `from` is a relative URL.
    const { pathname, search, hash } = resolvedUrl;
    return pathname + search + hash;
  }
  return resolvedUrl.toString();
}

resolve('/one/two/three', 'four');         // '/one/two/four'
resolve('http://example.com/', '/one');    // 'http://example.com/one'
resolve('http://example.com/one', '/two'); // 'http://example.com/two'
```
