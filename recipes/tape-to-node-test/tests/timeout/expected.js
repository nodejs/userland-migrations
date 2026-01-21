import { test } from 'node:test';
import assert from 'node:assert';

test('timeout test', { timeout: 100 }, (t) => {
    
    // t.end();
});

test('timeout test with options', { skip: false, timeout: 200 }, (t) => {
    
    // t.end();
});

test('nested timeout', (t) => {
    t.test('inner', { timeout: 50 }, (st) => {
        
        // st.end();
    });
});
