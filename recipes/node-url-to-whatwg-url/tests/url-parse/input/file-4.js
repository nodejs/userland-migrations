const { parse: urlParse } = require('node:url');

const myURL = urlParse('https://example.com/path?query=string#hash');

const { auth } = myURL;
const urlAuth = myURL.auth;

const { path } = myURL;
const urlPath = myURL.path;

const { hostname } = myURL;
const urlHostname = myURL.hostname;
