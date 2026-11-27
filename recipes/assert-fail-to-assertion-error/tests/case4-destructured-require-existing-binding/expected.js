const { fail: assertFail, AssertionError: AE } = require('assert');

throw new AE({ actual: a, expected: b, message: 'm', operator: 'fail' });
