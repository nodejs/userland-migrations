import('node:url').then(({ parse: urlParse }) => {
	const myURL = urlParse('https://example.com/path?query=string#hash');

	const { auth } = myURL;
	const urlAuth = myURL.auth;

	const { path } = myURL;
	const urlPath = myURL.path;

	const { hostname } = myURL;
	const urlHostname = myURL.hostname;
});

const urlParse = await import('node:url').then(({ parse }) => parse);

const myURL = urlParse('https://example.com/path?query=string#hash');

const { auth } = myURL;
const urlAuth = myURL.auth;

const { path } = myURL;
const urlPath = myURL.path;

const { hostname } = myURL;
const urlHostname = myURL.hostname;
