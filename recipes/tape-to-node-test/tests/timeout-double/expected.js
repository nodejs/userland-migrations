import { test } from 'node:test';
import assert from 'node:assert';

test('double timeout', { signal: AbortSignal.timeout(200) }, (t) => {
	// t.end();
});
