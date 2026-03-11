const assert = require('assert');
const fs = require('fs');
const { describe, before, after, it } = require('node:test');
describe('File System', () => {
	before(function() {
		fs.writeFileSync('test.txt', 'Hello, World!');
	});

	after(() => {
		fs.unlinkSync('test.txt');
	});

	it('should read the file', () => {
		const content = fs.readFileSync('test.txt', 'utf8');
		assert.strictEqual(content, 'Hello, World!');
	});
});
