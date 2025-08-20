const { format } = require('node:url');

const c = format({
    protocol: 'https',
    auth: 'user:pass',
    hostname: 'example.com',
    pathname: '/has-auth',
});
