import { test } from 'node:test';
import assert from 'node:assert';

test('timeout test', { signal: AbortSignal.timeout(100) }, (t) => {
    // t.end();
});

test('timeout test with options', { skip: false, signal: AbortSignal.timeout(200) }, (t) => {
    // t.end();
});

test('nested timeout', (t) => {
    t.test('inner', { signal: AbortSignal.timeout(50) }, (st) => {
        // st.end();
    });
});
