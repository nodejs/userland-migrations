import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it } from "node:test";

import removeDependencies from "./remove-dependencies.ts";

describe("removeDependencies", () => {
	it("should return null when no dependencies are specified", () => {
		const result = removeDependencies();
		assert.strictEqual(result, null);
	});

	it("should return null when empty array is provided", () => {
		const result = removeDependencies([]);
		assert.strictEqual(result, null);
	});

	it("should return null when package.json does not exist in current directory", async () => {
		const tempDir = await mkdtemp(join(tmpdir(), "remove-deps-test-"));
		const originalCwd = process.cwd();

		try {
			process.chdir(tempDir);
			const result = removeDependencies("chalk");
			assert.strictEqual(result, null);
		} finally {
			process.chdir(originalCwd);
			await rm(tempDir, { recursive: true });
		}
	});

	it("should handle package.json with no dependencies sections", async () => {
		const tempDir = await mkdtemp(join(tmpdir(), "remove-deps-test-"));
		const originalCwd = process.cwd();

		const packageJsonContent = {
			name: "test-package",
			version: "1.0.0",
		};

		try {
			process.chdir(tempDir);
			await writeFile("package.json", JSON.stringify(packageJsonContent, null, 2));

			const result = removeDependencies("chalk");

			assert.strictEqual(result, null);
		} finally {
			process.chdir(originalCwd);
			await rm(tempDir, { recursive: true });
		}
	});

	it("should remove a single dependency from dependencies", async () => {
		const tempDir = await mkdtemp(join(tmpdir(), "remove-deps-test-"));
		const originalCwd = process.cwd();

		const packageJsonContent = {
			name: "test-package",
			version: "1.0.0",
			dependencies: {
				chalk: "^4.0.0",
				lodash: "^4.17.21",
			},
		};

		try {
			process.chdir(tempDir);
			await writeFile("package.json", JSON.stringify(packageJsonContent, null, 2));

			removeDependencies("chalk");

			const updatedContent = readFileSync("package.json", "utf-8");
			const updatedPackageJson = JSON.parse(updatedContent);

			assert.strictEqual(updatedPackageJson.dependencies.chalk, undefined);
			assert.strictEqual(updatedPackageJson.dependencies.lodash, "^4.17.21");
		} finally {
			process.chdir(originalCwd);
			await rm(tempDir, { recursive: true });
		}
	});

	it("should remove multiple dependencies from both dependencies and devDependencies", async () => {
		const tempDir = await mkdtemp(join(tmpdir(), "remove-deps-test-"));
		const originalCwd = process.cwd();

		const packageJsonContent = {
			name: "test-package",
			version: "1.0.0",
			dependencies: {
				chalk: "^4.0.0",
				lodash: "^4.17.21",
			},
			devDependencies: {
				jest: "^29.0.0",
				typescript: "^5.0.0",
				chalk: "^4.0.0",
			},
		};

		try {
			process.chdir(tempDir);
			await writeFile("package.json", JSON.stringify(packageJsonContent, null, 2));

			removeDependencies(["chalk", "jest"]);

			const updatedContent = readFileSync("package.json", "utf-8");
			const updatedPackageJson = JSON.parse(updatedContent);

			assert.strictEqual(updatedPackageJson.dependencies.chalk, undefined);
			assert.strictEqual(updatedPackageJson.dependencies.lodash, "^4.17.21");
			assert.strictEqual(updatedPackageJson.devDependencies.chalk, undefined);
			assert.strictEqual(updatedPackageJson.devDependencies.jest, undefined);
			assert.strictEqual(updatedPackageJson.devDependencies.typescript, "^5.0.0");
		} finally {
			process.chdir(originalCwd);
			await rm(tempDir, { recursive: true });
		}
	});

	it("should return null when no specified dependencies are found", async () => {
		const tempDir = await mkdtemp(join(tmpdir(), "remove-deps-test-"));
		const originalCwd = process.cwd();

		const packageJsonContent = {
			name: "test-package",
			version: "1.0.0",
			dependencies: {
				lodash: "^4.17.21",
			},
		};

		try {
			process.chdir(tempDir);
			await writeFile("package.json", JSON.stringify(packageJsonContent, null, 2));

			const result = removeDependencies(["chalk", "jest"]);

			assert.strictEqual(result, null);
		} finally {
			process.chdir(originalCwd);
			await rm(tempDir, { recursive: true });
		}
	});
});
