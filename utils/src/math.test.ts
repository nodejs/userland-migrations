import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { gcd } from './math.ts';

describe('gcd', () => {
	it('should return the greatest common divisor of two numbers', () => {
		assert.equal(gcd(48, 18), 6);
		assert.equal(gcd(56, 98), 14);
		assert.equal(gcd(101, 10), 1);
		assert.equal(gcd(-48, 18), 6);
		assert.equal(gcd(48, -18), 6);
		assert.equal(gcd(-48, -18), 6);
		assert.equal(gcd(0, 5), 5);
		assert.equal(gcd(5, 0), 5);
		assert.equal(gcd(0, 0), 0);
	});

	it('should throw TypeError if arguments are not numbers', () => {
		assert.throws(() => gcd('48' as unknown as number, 18), {
			name: 'TypeError',
			message: 'Both arguments must be numbers.',
		});
		assert.throws(() => gcd(48, null as unknown as number), {
			name: 'TypeError',
			message: 'Both arguments must be numbers.',
		});
		assert.throws(() => gcd(undefined as unknown as number, 18), {
			name: 'TypeError',
			message: 'Both arguments must be numbers.',
		});
	});
});
