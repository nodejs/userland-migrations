const assert = require('assert');
describe('Skipped Test', () => {
	it.skip('should not run this test', () => {
		assert.strictEqual(1 + 1, 3);
	});
	it('should also be skipped', () => {
		this.skip();
		assert.strictEqual(1 + 1, 3);
	});

	it('should also be skipped 2', (done) => {
		this.skip();
		assert.strictEqual(1 + 1, 3);
	});

	it('should also be skipped 3', x => {
		this.skip();
		assert.strictEqual(1 + 1, 3);
	});
});
