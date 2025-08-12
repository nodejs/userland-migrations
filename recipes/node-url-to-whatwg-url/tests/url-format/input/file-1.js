const url = require('node:url');

const str = url.format({
    protocol: 'https',
    hostname: 'example.com',
    pathname: '/some/path',
    search: '?page=1'
});
