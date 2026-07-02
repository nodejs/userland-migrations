import { mock } from 'node:test';

const foo = {
	a: 'a',
	b: 'b',
	c: 'c'
}

const mockValues = {
	exports: {
		default: 'bar',
		...foo,
	},
}

mock.module('example', mockValues);
