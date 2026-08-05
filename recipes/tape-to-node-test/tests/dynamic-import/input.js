async function run() {
	const test = await import("tape");

	test("dynamic import", (t) => {
		t.ok(true);
	});
}
