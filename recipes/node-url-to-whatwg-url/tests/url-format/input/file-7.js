const { format } = require('node:url');

const search = 'page=2';
const proto = 'https:';

const d = format({
    protocol: proto,
    host: 'example.com:443',
    pathname: '/norm',
    search,
});
