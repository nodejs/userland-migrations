import url from 'node:url';

const a = url.format({
	protocol: 'https',
	hostname: 'example.com',
	pathname: '/esm-default',
});
