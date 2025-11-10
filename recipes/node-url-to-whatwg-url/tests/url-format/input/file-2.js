const { format } = require('node:url');

const a = format({
    protocol: 'https:',
    host: 'example.com:8080',
    pathname: 'p',
    query: { page: '1', format: 'json' },
    hash: 'frag',
});
