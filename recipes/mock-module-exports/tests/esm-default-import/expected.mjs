import test from 'node:test';

const bar = 'bar'
const foo = 'foo'

test.mock.module('example', {
	exports: {
		default: bar,
		foo: foo,
	},
});
