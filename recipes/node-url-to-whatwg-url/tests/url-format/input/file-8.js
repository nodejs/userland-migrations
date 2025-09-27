const { format } = require('node:url');

const e = format({
    protocol: 'https',
    hostname: 'example.com',
    port: '3000',
    pathname: 'no-leading-slash',
});
