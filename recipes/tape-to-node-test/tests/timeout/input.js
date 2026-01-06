import test from 'tape';

test('timeout test', (t) => {
    t.timeoutAfter(100);
    t.end();
});

test('timeout test with options', { skip: false }, (t) => {
    t.timeoutAfter(200);
    t.end();
});

test('nested timeout', (t) => {
    t.test('inner', (st) => {
        st.timeoutAfter(50);
        st.end();
    });
});
