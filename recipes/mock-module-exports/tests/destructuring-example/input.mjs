import { mock } from 'node:test';

const foo = {
	a: 'a',
	b: 'b',
	c: 'c'
}

const mockValues = {
	defaultExport: 'bar',
	namedExports: {
		...foo
	},
}

mock.module('example', mockValues);
