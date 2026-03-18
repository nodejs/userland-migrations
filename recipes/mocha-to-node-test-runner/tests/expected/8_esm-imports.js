import assert from 'assert';
import { describe, it } from 'node:test';

describe('Array', function() {
	describe.skip('#indexOf()', function() {
		it('should return -1 when the value is not present', function() {
			const arr = [1, 2, 3];
			assert.strictEqual(arr.indexOf(4), -1);
		});
	});
});
