const assert = require('assert');
const { describe, it } = require('node:test');
describe('Timeout Test', { timeout: 500 }, function() {


	it('should complete within 100ms', { timeout: 100 }, (t, done) => {

		setTimeout(done, 500); // This will fail
	});

	it('should complete within 200ms', { timeout: 200 }, function(t, done) {

		setTimeout(done, 100); // This will pass
	});
});
