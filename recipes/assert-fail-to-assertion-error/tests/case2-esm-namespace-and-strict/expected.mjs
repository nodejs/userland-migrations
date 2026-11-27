import * as nodeAssert from 'node:assert';
import strict from 'assert/strict';

function check(value) {
	if (value > 10) {
		throw new nodeAssert.AssertionError({ actual: value, expected: 10, message: 'too big', operator: 'fail' });
	}
	throw new strict.AssertionError({ actual: value, expected: 0, operator: '!=' });
}
