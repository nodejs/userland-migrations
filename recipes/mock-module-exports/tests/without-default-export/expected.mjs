import { mock } from 'node:test';

mock.module('example', {
	exports: {
		foo: 'foo',
	},
});
