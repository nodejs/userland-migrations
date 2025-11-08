const nodeUrl = require('node:url');

const myURL = new URL('https://example.com/path?query=string#hash');

const auth = `${myURL.username}:${myURL.password}`;
const urlAuth = `${myURL.username}:${myURL.password}`;

const path = `${myURL.pathname}${myURL.search}`;
const urlPath = `${myURL.pathname}${myURL.search}`;

const hostname = myURL.hostname.replace(/^\[|\]$/, '');
const urlHostname = myURL.hostname.replace(/^\[|\]$/, '');
