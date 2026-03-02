const assert = require('assert');
describe('Timeout Test', function() {
	this.timeout(500);

	it('should complete within 100ms', (done) => {
		this.timeout(100);
		setTimeout(done, 500); // This will fail
	});

	it('should complete within 200ms', function(done) {
		this.timeout(200);
		setTimeout(done, 100); // This will pass
	});
});
