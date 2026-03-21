import { mock } from 'node:test';

const mockValues = {
	exports: {
		default: 'bar',
		foo: 'foo',
	},
}

mock.module('example', mockValues);
