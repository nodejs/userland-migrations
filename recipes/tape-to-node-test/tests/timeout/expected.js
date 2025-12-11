import { test } from 'node:test';
import assert from 'node:assert';

test('timeout test', { timeout: 100 }, async (t) => {
    
    // t.end();
});

test('timeout test with options', { skip: false, timeout: 200 }, async (t) => {
    
    // t.end();
});

test('nested timeout', async (t) => {
    await t.test('inner', { timeout: 50 }, async (st) => {
        
        // st.end();
    });
});
