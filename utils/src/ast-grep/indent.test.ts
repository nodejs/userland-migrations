import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { detectIndentUnit, getLineIndent } from './indent.ts';

describe('detectIndentUnit', () => {
	it('should detect tab indentation', () => {
		const source = '\tfunction test() {\n\t\tconsole.log("Hello");\n\t}';
		assert.equal(detectIndentUnit(source), '\t');
	});

	it('should detect space indentation', () => {
		const source =
			'    function test() {\n        console.log("Hello");\n    }';
		assert.equal(detectIndentUnit(source), '    ');
	});

	it('should detect mixed indentation and return the most common one', () => {
		const source =
			'  function test() {\n    console.log("Hello");\n\tconsole.log("World");\n  }';
		assert.equal(detectIndentUnit(source), '\t');
	});

	it('should return empty string if no indentation is found', () => {
		const source = 'function test() {\nconsole.log("Hello");\n}';
		assert.equal(detectIndentUnit(source), '\t');
	});

	it('should handle empty source', () => {
		const source = '';
		assert.equal(detectIndentUnit(source), '\t');
	});

	it('should handle lines with only whitespace', () => {
		const source = '   \n\t\t\n   ';
		assert.equal(detectIndentUnit(source), '\t');
	});

	it('should handle inconsistent indentation', () => {
		const source = ' \t \t\n  \t\n\t';
		assert.equal(detectIndentUnit(source), '\t');
	});

	it('should handle no indentation at all', () => {
		const source = 'function test() {\nconsole.log("Hello");\n}';
		assert.equal(detectIndentUnit(source), '\t');
	});

	it('should handle a single line of code', () => {
		const source = 'console.log("Hello");';
		assert.equal(detectIndentUnit(source), '\t');
	});
});

describe('getLineIndent', () => {
	it('should return the correct indentation for a given line index', () => {
		const source =
			'function test() {\n    console.log("Hello");\n\tconsole.log("World");\n}';
		assert.equal(getLineIndent(source, 25), '    ');
		assert.equal(getLineIndent(source, 50), '\t');
		assert.equal(getLineIndent(source, 0), '');
	});

	it('should handle lines with no indentation', () => {
		const source = 'function test() {\nconsole.log("Hello");\n}';
		assert.equal(getLineIndent(source, 20), '');
	});

	it('should handle empty source', () => {
		const source = '';
		assert.equal(getLineIndent(source, 0), '');
	});
});

describe('getLineIndent - additional tests', () => {
	it('should handle index out of bounds', () => {
		const source = 'function test() {\n    console.log("Hello");\n}';
		assert.equal(getLineIndent(source, 100), '');
	});

	it('should handle lines with only whitespace', () => {
		const source = '   \n\t\t\n   ';
		assert.equal(getLineIndent(source, 1), '   ');
	});

	it('should handle an empty string', () => {
		const source = '';
		assert.equal(getLineIndent(source, 0), '');
	});
});
