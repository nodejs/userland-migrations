const { parse } = require('node:url');

const absolute = new URL('https://example.com/a?b=1');
const relative = parse('/a?b=1');
const protocolRelative = parse('//example.com/a');
const template = parse(`/a/b`);

console.log(`${absolute.pathname}${absolute.search}`, relative.path, protocolRelative.host, template.path);
console.log(parse('/direct').path);
