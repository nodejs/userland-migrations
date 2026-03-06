import test from 'node:test';

test.mock.module('example', {
	exports: {
		default: 'bar',
		foo: 'foo',
	},
});
