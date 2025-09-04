const { format } = require('node:url');

const search = 'page=2';
const proto = 'https:';

const d = new URL(`${proto}://example.com:443/norm${search}`).toString();
