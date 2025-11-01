const url = require('node:url');

const myURL = url.parse('/path?query=string#hash');

const { auth } = myURL;
const urlAuth = myURL.auth;

const { path } = myURL;
const urlPath = myURL.path;

const { hostname } = myURL;
const urlHostname = myURL.hostname;

