const assert = require('assert');
describe('Callback Test', function() {
	it('should call done when complete', function(done) {
		setTimeout(() => {
			assert.strictEqual(1 + 1, 2);
			done();
		}, 100);
	});
});
