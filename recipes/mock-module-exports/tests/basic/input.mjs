import { mock } from 'node:test';

mock.module('example', {
	defaultExport: 'bar',
	namedExports: {
		foo: 'foo',
		baz: 'baz',
	},
});

const namedExports = {
	foo: 'foo',
	baz: 'baz',
}

mock.module('example2', {
	defaultExport: 'bar',
	namedExports: namedExports,
});

function getDefault() {
	return 'bar'
}

function getBar() {
	return 'bar'
}

mock.module('example3', {
	exports: {
		defaultExport: getDefault(),
		namedExports: {
			bar: getBar(),
		}
	},
});

mock.module('example-no-named', {
	exports: {
		defaultExport: getDefault(),
	},
});

mock.module('example-no-fault', {
	exports: {
		namedExports: {
			bar: 'bar',
		}
	},
});

mock.module('example-empty', {
	exports: {
	},
});
