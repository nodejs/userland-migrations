const assert = require('node:assert');

throw new assert.AssertionError({ actual: 1, expected: 2, operator: '!=' });
throw new assert.AssertionError({ actual: actual, expected: expected, message: 'values differ', operator: 'fail' });
throw new assert.AssertionError({ actual: actual, expected: expected, operator: '>' });
throw new assert.AssertionError({ actual: actual, expected: expected, message: `no match`, operator: '===', stackStartFn: check })
assert.fail('only a message');
assert.fail();
