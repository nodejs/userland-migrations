const nodeUrl = require('node:url');

const b = nodeUrl.format({
    protocol: 'http',
    hostname: 'example.com',
    port: '3000',
    pathname: '/x',
});
