import { mock } from 'node:test';

mock.module('example', {
	exports: {
		default: 'bar',
		foo: 'foo',
	},
});
