import { mock } from 'node:test';

mock.module('example', {
	namedExports: {
		foo: 'foo',
	},
});
