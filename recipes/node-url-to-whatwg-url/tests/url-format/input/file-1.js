const url = require('node:url');

const str = url.format({
	protocol: 'https',
	hostname: 'example.com',
	pathname: '/some/path',
	search: '?page=1'
});

const foo = 'https';

const search = '?page=1';

const str2 = url.format({
	protocol: foo,
	hostname: 'example.com',
	pathname: '/some/path',
	search
});
