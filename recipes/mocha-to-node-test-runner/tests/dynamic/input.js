const assert = require('assert');

describe('Dynamic Tests', () => {
	const tests = [1, 2, 3];
	tests.forEach((test) => {
		it(`should handle test ${test}`, () => {
			assert.strictEqual(test % 2, 0);
		});
	});

	for(const test of tests) {
		it(`should handle test ${test}`, () => {
			assert.strictEqual(test % 2, 0);
		});
	}
});
