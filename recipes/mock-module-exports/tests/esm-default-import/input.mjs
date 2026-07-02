import test from 'node:test';

const bar = 'bar'
const foo = 'foo'

test.mock.module('example', {
	defaultExport: bar,
	namedExports: {
		foo: foo,
	},
});
