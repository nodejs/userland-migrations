import test from 'tape';

test.skip('skipped test', (t) => {
    t.fail('should not run');
    t.end();
});

test.only('only test', (t) => {
    t.pass('should run');
    t.end();
});
