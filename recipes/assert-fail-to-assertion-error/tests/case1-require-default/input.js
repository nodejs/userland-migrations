const assert = require('node:assert');

assert.fail(1, 2);
assert.fail(actual, expected, 'values differ');
assert.fail(actual, expected, undefined, '>');
assert.fail(actual, expected, `no match`, '===', check)
assert.fail('only a message');
assert.fail();
