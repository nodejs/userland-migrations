const assert = require('assert');
const { describe, it } = require('node:test');
describe('Skipped Test', () => {
	it.skip('should not run this test', () => {
		assert.strictEqual(1 + 1, 3);
	});
	it('should also be skipped', (t) => {
		t.skip();
		assert.strictEqual(1 + 1, 3);
	});

	it('should also be skipped 2', (t, done) => {
		t.skip();
		assert.strictEqual(1 + 1, 3);
	});

	it('should also be skipped 3', (t, x) => {
		t.skip();
		assert.strictEqual(1 + 1, 3);
	});
});
