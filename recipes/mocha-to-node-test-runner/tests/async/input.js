const assert = require('assert');
describe('Async Test', function() {
	it('should complete after a delay', async function(done) {
		const result = await new Promise(resolve => setTimeout(() => resolve(42), 100));
		assert.strictEqual(result, 42);
	});
});
