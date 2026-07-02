import { mock } from 'node:test';

const foo = {
	a: 'a',
	b: 'b',
	c: 'c'
}

function mockValues() {
	return {
		exports: {
			default: 'bar',
			...foo,
		},
	}
}

mock.module('example', mockValues());
