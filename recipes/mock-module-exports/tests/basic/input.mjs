import { mock } from 'node:test';

mock.module('example', {
	defaultExport: 'bar',
	namedExports: {
		foo: 'foo',
		baz: 'baz',
	},
});
