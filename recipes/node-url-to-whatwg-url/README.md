# Node.js URL to WHATWG URL

This recipe converts Node.js `url` module usage to the WHATWG URL API. It modifies code that uses the legacy `url` module to use the modern `URL` class instead.

See [DEP0116](https://nodejs.org/api/deprecations.html#DEP0116).

## Example

### `url.parse` to `new URL()`

**Before:**
```js
const url = require('node:url');

const myURL = url.parse('https://example.com/path?query=string#hash');

const { auth } = myURL;
const urlAuth = myURL.auth;

const { path } = myURL;
const urlPath = myURL.path;

const { hostname } = myURL;
const urlHostname = myURL.hostname;
```

**After:**
```js
const myURL = new URL('https://example.com/path?query=string#hash');

const auth = `${myURL.username}:${myURL.password}`;
const urlAuth = `${myURL.username}:${myURL.password}`;

const path = `${myURL.pathname}${myURL.search}`;
const urlPath = `${myURL.pathname}${myURL.search}`;

const hostname = myURL.hostname.replace(/^\[|\]$/, '');
const urlHostname = myURL.hostname.replace(/^\[|\]$/, '');
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

> **Note:** The migration of `url.format` can also be done as `` `${new URL('https://example.com/some/path?page=1&format=json')}` `` which is little bit more efficient. But it may be less readable for some users.

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

If you are using `url.parse().auth`, `url.parse().username`, or `url.parse().password`. Will transform to `new URL().auth` which is not valid WHATWG url property. So you have to manually construct the `auth`, `path`, and `hostname` properties as shown in the examples above.

