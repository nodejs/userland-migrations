import assert from "node:assert/strict";
import { describe, it } from "node:test";
import process from "node:process";
import { spawnPromisified } from "./spawn-promisified.ts";

describe("spawnPromisified",{concurrency: true} , () => {
  it("should spawn a process and return its output", async () => {
	const { code, stdout, stderr } = await spawnPromisified(
	  "echo",
	  ["Hello, World!"],
	  {
		cwd: import.meta.dirname,
	  }
	);

	assert.strictEqual(code, 0);
	assert.strictEqual(stdout.trim(), "Hello, World!");
	assert.strictEqual(stderr, "");
  });

  it("should handle node process arguments", async () => {
	const { code, stdout, stderr } = await spawnPromisified(
	  process.execPath,
	  ["-e", "console.log('Hello from Node!')"],
	  {
		cwd: import.meta.dirname,
	  }
	);

	assert.strictEqual(code, 0);
	assert.strictEqual(stdout.trim(), "Hello from Node!");
	assert.strictEqual(stderr, "");
  });


  it("should handle errors in the spawned process", async () => {
	try {
	  // @ts-ignore - it's a test, we expect that argument to be invalid
	  await spawnPromisified("nonexistent-command");
	} catch (error) {
	  assert.strictEqual(error.error.code, "ENOENT");
	}
  });
});
