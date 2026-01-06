import { test } from 'node:test';
import assert from 'node:assert';

test("callback style", (t, done) => {
    setTimeout(() => {
        assert.ok(true);
        done();
    }, 100);
});
