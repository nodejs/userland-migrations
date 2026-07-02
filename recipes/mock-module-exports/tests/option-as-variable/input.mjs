import { mock } from 'node:test';

const mockValues = {
	defaultExport: 'bar',
	namedExports: {
		foo: 'foo',
	},
}

mock.module('example', mockValues);
