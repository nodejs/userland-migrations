const assert = require('assert');

describe('Array', function() {
	describe.skip('#indexOf()', function() {
		it('should return -1 when the value is not present', function() {
			const arr = [1, 2, 3];
			assert.strictEqual(arr.indexOf(4), -1);
		});
	});
});

describe('Set', () => {
	it('should return true when the value is present', () => {
		const set = new Set([1, 2, 3]);
		assert.strictEqual(set.has(2), true);
	});
});

