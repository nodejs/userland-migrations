import { fail, ok, AssertionError } from 'node:assert';

ok(true);
throw new AssertionError({ actual: a, expected: b, operator: '!=' });
fail('still fine');
