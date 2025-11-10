const { format } = require('node:url');

const e = new URL('https://example.com:3000/no-leading-slash').toString();
