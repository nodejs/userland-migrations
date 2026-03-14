import { mock } from 'node:test';

const foo = {
	a: 'a',
	b: 'b',
	c: 'c'
}

function mockValues() {
	return {
		defaultExport: 'bar',
		namedExports: {
			...foo,
		},
	}
}

mock.module('example', mockValues());
