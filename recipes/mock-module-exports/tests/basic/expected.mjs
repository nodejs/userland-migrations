import { mock } from 'node:test';

mock.module('example', {
	exports: {
		default: 'bar',
		foo: 'foo',
		baz: 'baz',
	},
});

const namedExports = {
	foo: 'foo',
	baz: 'baz',
}

mock.module('example2', {
	exports: {
		default: 'bar',
		...(namedExports || {}),
	},
});

function getDefault() {
	return 'bar'
}

function getBar() {
	return 'bar'
}

mock.module('example3', {
	exports: {
		default: getDefault(),
		bar: getBar(),
	},
});

mock.module('example-no-named', {
	exports: {
		default: getDefault(),
	},
});

mock.module('example-no-fault', {
	exports: {
		bar: 'bar',
	},
});

mock.module('example-empty', {
	exports: {
	},
});
