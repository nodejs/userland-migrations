import * as nodeAssert from 'node:assert';
import strict from 'assert/strict';

function check(value) {
	if (value > 10) {
		nodeAssert.fail(value, 10, 'too big');
	}
	strict.fail(value, 0);
}
