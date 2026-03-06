import test from 'node:test';

test.mock.module('example', {
	defaultExport: 'bar',
	namedExports: {
		foo: 'foo',
	},
});
