const url = require('node:url');

const str = new URL('https://example.com/some/path?page=1').toString();

const foo = 'https';

const search = '?page=1';

const str2 = new URL(`${foo}://example.com/some/path${search}`).toString();
