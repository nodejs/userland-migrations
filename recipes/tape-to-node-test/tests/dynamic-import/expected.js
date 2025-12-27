async function run() {
  const { test } = await import('node:test');
const { default: assert } = await import('node:assert');
  
  test("dynamic import", async (t) => {
    assert.ok(true);
    // t.end();
  });
}
