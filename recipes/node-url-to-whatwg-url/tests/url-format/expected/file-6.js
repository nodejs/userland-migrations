const { format } = require('node:url');

const c = new URL('https://user:pass@example.com/has-auth').toString();
