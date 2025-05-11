import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { workflow } from "./workflow.ts";

describe("workflow", () => {
	it("should migrate jest to node:test", async (t) => {
		const e2eFixtPath = fileURLToPath(import.meta.resolve("./fixtures/e2e/"));
		const source = await readFile(resolve(e2eFixtPath, "test.ts"), { encoding: "utf-8" });
		const result = await workflow(source);

		t.assert.snapshot(result);
	});

	it("should migrate jest.fn with no arguments", async (t) => {
		const source = "const mockFn = jest.fn();";
		const result = await workflow(source);
		t.assert.match(result, /const mockFn = mock\.fn\(\);/);
	});

	it("should migrate jest.fn with argument", async (t) => {
		const source = "const a = jest.fn((i: number, j: number) => i + j);";
		const result = await workflow(source);
		t.assert.match(result, /const a = mock\.fn\(\(i: number, j: number\) => i \+ j\);/);
	});

	it("should migrate jest.mock", async (t) => {
		const source = 'jest.mock("./workflow.ts");';
		const result = await workflow(source);
		t.assert.match(result, /mock\.module\("\.\/workflow\.ts"\);/);
	});

	it("should migrate jest.spyOn", async (t) => {
		const source = 'const logSpy = jest.spyOn(console, "log");';
		const result = await workflow(source);
		t.assert.match(result, /const logSpy = mock\.method\(console,"log"\);/);
	});

	it("should migrate toHaveBeenCalled", async (t) => {
		const source = "expect(a).toHaveBeenCalled();";
		const result = await workflow(source);
		t.assert.match(result, /expect\(a.mock.callCount\(\)\).toBeTruthy\(\);/);
	});

	it("should migrate toBeCalled", async (t) => {
		const source = "expect(a).toBeCalled();";
		const result = await workflow(source);
		t.assert.match(result, /expect\(a.mock.callCount\(\)\).toBeTruthy\(\);/);
	});

	it("should migrate toHaveBeenCalledTimes", async (t) => {
		const source = "expect(a).toHaveBeenCalledTimes(2);";
		const result = await workflow(source);
		t.assert.match(result, /expect\(a.mock.callCount\(\)\).toBe\(2\);/);
	});

	it("should migrate toBeCalledTimes", async (t) => {
		const source = "expect(a).toBeCalledTimes(2);";
		const result = await workflow(source);
		t.assert.match(result, /expect\(a.mock.callCount\(\)\).toBe\(2\);/);
	});

	it("should migrate toHaveBeenCalledWith", async (t) => {
		const source = "expect(a).toHaveBeenCalledWith(1, 1);";
		const result = await workflow(source);
		t.assert.match(
			result,
			/expect\(a.mock.calls.map\(call => call.arguments\)\).toContainEqual\(\[1,1\]\);/,
		);
	});

	it("should migrate toBeCalledWith", async (t) => {
		const source = "expect(a).toBeCalledWith(1, 1);";
		const result = await workflow(source);
		t.assert.match(
			result,
			/expect\(a.mock.calls.map\(call => call.arguments\)\).toContainEqual\(\[1,1\]\);/,
		);
	});

	it("should migrate toHaveBeenLastCalledWith", async (t) => {
		const source = "expect(a).toHaveBeenLastCalledWith(2, 2);";
		const result = await workflow(source);
		t.assert.match(result, /expect\(a.mock.calls.at\(-1\)\?.arguments\).toStrictEqual\(\[2,2\]\);/);
	});

	it("should migrate lastCalledWith", async (t) => {
		const source = "expect(a).lastCalledWith(2, 2);";
		const result = await workflow(source);
		t.assert.match(result, /expect\(a.mock.calls.at\(-1\)\?.arguments\).toStrictEqual\(\[2,2\]\);/);
	});

	it("should migrate toHaveBeenNthCalledWith", async (t) => {
		const source = "expect(a).toHaveBeenNthCalledWith(1, 1, 1);";
		const result = await workflow(source);
		t.assert.match(result, /expect\(a.mock.calls\[0\].arguments\).toStrictEqual\(\[1,1\]\);/);
	});

	it("should migrate nthCalledWith", async (t) => {
		const source = "expect(a).nthCalledWith(2, 2, 2);";
		const result = await workflow(source);
		t.assert.match(result, /expect\(a.mock.calls\[1\].arguments\).toStrictEqual\(\[2,2\]\);/);
	});

	it("should migrate toHaveReturned", async (t) => {
		const source = "expect(a).toHaveReturned();";
		const result = await workflow(source);
		t.assert.match(
			result,
			/expect\(a.mock.calls.some\(call => call.error === undefined\)\).toBeTruthy\(\);/,
		);
	});

	it("should migrate toReturn", async (t) => {
		const source = "expect(a).toReturn();";
		const result = await workflow(source);
		t.assert.match(
			result,
			/expect\(a.mock.calls.some\(call => call.error === undefined\)\).toBeTruthy\(\);/,
		);
	});

	it("should migrate toHaveReturnedTimes", async (t) => {
		const source = "expect(a).toHaveReturnedTimes(2);";
		const result = await workflow(source);
		t.assert.match(
			result,
			/expect\(a.mock.calls.filter\(call => call.error === undefined\)\).toHaveLength\(2\);/,
		);
	});

	it("should migrate toReturnTimes", async (t) => {
		const source = "expect(a).toReturnTimes(2);";
		const result = await workflow(source);
		t.assert.match(
			result,
			/expect\(a.mock.calls.filter\(call => call.error === undefined\)\).toHaveLength\(2\);/,
		);
	});

	it("should migrate toHaveReturnedWith", async (t) => {
		const source = "expect(a).toHaveReturnedWith(2);";
		const result = await workflow(source);
		t.assert.match(
			result,
			/expect\(a.mock.calls.map\(call => call.result\)\).toContainEqual\(2\);/,
		);
	});

	it("should migrate toReturnWith", async (t) => {
		const source = "expect(a).toReturnWith(4);";
		const result = await workflow(source);
		t.assert.match(
			result,
			/expect\(a.mock.calls.map\(call => call.result\)\).toContainEqual\(4\);/,
		);
	});

	it("should migrate toHaveLastReturnedWith", async (t) => {
		const source = "expect(a).toHaveLastReturnedWith(4);";
		const result = await workflow(source);
		t.assert.match(result, /expect\(a.mock.calls.at\(-1\)\?.result\).toBe\(4\);/);
	});

	it("should migrate lastReturnedWith", async (t) => {
		const source = "expect(a).lastReturnedWith(4);";
		const result = await workflow(source);
		t.assert.match(result, /expect\(a.mock.calls.at\(-1\)\?.result\).toBe\(4\);/);
	});

	it("should migrate toHaveNthReturnedWith", async (t) => {
		const source = "expect(a).toHaveNthReturnedWith(1, 2);";
		const result = await workflow(source);
		t.assert.match(result, /expect\(a.mock.calls\[0\].result\).toBe\(2\);/);
	});

	it("should migrate nthReturnedWith", async (t) => {
		const source = "expect(a).nthReturnedWith(2, 4);";
		const result = await workflow(source);
		t.assert.match(result, /expect\(a.mock.calls\[1\].result\).toBe\(4\);/);
	});

	it("should migrate mock.calls", async (t) => {
		const source = "a.mock.calls";
		const result = await workflow(source);
		t.assert.match(result, /a\.mock\.calls\.map\(\(call\) => call\.arguments\)/);
	});

	it("should migrate mock.results", async (t) => {
		const source = "a.mock.results";
		const result = await workflow(source);
		t.assert.match(
			result,
			/a\.mock\.calls\.map\(\(call\) => \(\{\s*type: call\.error \? "throw" : "return",\s*value: call\.error \? call\.error : call\.result,\s*\}\)\)/,
		);
	});

	it("should migrate mock.lastCall", async (t) => {
		const source = "a.mock.lastCall";
		const result = await workflow(source);
		t.assert.match(result, /a\.mock\.calls\.at\(-1\)\?\.arguments/);
	});

	it("should migrate mockClear", async (t) => {
		const source = "a.mockClear()";
		const result = await workflow(source);
		t.assert.match(result, /a\.mock\.resetCalls\(\)/);
	});

	it("should migrate mockReset", async (t) => {
		const source = "a.mockReset()";
		const result = await workflow(source);
		t.assert.match(result, /a\.mock\.restore\(\)/);
	});

	it("should migrate mockRestore", async (t) => {
		const source = "a.mockRestore()";
		const result = await workflow(source);
		t.assert.match(result, /a\.mock\.restore\(\)/);
	});

	it("should migrate mockImplementation", async (t) => {
		const source = "a.mockImplementation((i: number, j: number) => i * j)";
		const result = await workflow(source);
		t.assert.match(result, /a\.mock\.mockImplementation\(\(i: number, j: number\) => i \* j\)/);
	});

	it("should migrate mockImplementationOnce", async (t) => {
		const source = "a.mockImplementationOnce((i: number, j: number) => i - j)";
		const result = await workflow(source);
		t.assert.match(result, /a\.mock\.mockImplementationOnce\(\(i: number, j: number\) => i - j\)/);
	});

	it("should migrate mockReturnValue", async (t) => {
		const source = "a.mockReturnValue(42)";
		const result = await workflow(source);
		t.assert.match(result, /a\.mock\.mockImplementation\(\(\) => 42\)/);
	});

	it("should migrate mockReturnValueOnce", async (t) => {
		const source = "a.mockReturnValueOnce(42)";
		const result = await workflow(source);
		t.assert.match(result, /a\.mock\.mockImplementationOnce\(\(\) => 42\)/);
	});

	it("should migrate mockRejectedValue", async (t) => {
		const source = 'b.mockRejectedValue(new Error("Test error"))';
		const result = await workflow(source);
		t.assert.match(
			result,
			/b\.mock\.mockImplementation\(async \(\) => \{\s*throw new Error\("Test error"\);\s*\}\)/,
		);
	});

	it("should migrate mockRejectedValueOnce", async (t) => {
		const source = 'b.mockRejectedValueOnce(new Error("Test error once"))';
		const result = await workflow(source);
		t.assert.match(
			result,
			/b\.mock\.mockImplementationOnce\(async \(\) => \{\s*throw new Error\("Test error once"\);\s*\}\)/,
		);
	});

	it("should migrate mockResolvedValue", async (t) => {
		const source = "b.mockResolvedValue(42)";
		const result = await workflow(source);
		t.assert.match(result, /b\.mock\.mockImplementation\(async \(\) => 42\)/);
	});

	it("should migrate mockResolvedValueOnce", async (t) => {
		const source = "b.mockResolvedValueOnce(42)";
		const result = await workflow(source);
		t.assert.match(result, /b\.mock\.mockImplementationOnce\(async \(\) => 42\)/);
	});

	it("should migrate toMatchSnapshot with no arguments", async (t) => {
		const source = "expect({ a: 1 }).toMatchSnapshot();";
		const result = await workflow(source);
		t.assert.match(result, /t\.assert\.snapshot\(\{ a: 1 \}\)/);
	});

	it("should migrate toMatchSnapshot with property matchers", async (t) => {
		const source =
			"expect(user).toMatchSnapshot({ id: expect.any(Number), createdAt: expect.any(Date) });";
		const result = await workflow(source);
		t.assert.match(result, /t\.assert\.snapshot\(user\)/);
	});

	it("should migrate toMatchSnapshot with hint", async (t) => {
		const source = 'expect(data).toMatchSnapshot("custom hint");';
		const result = await workflow(source);
		t.assert.match(result, /t\.assert\.snapshot\(data\)/);
	});

	it("should migrate toMatchInlineSnapshot with just snapshot", async (t) => {
		const source = `expect({ b: 2 }).toMatchInlineSnapshot(\`
{
"b": 2,
}
\`);`;
		const result = await workflow(source);
		t.assert.match(result, /t\.assert\.snapshot\(\{ b: 2 \}\)/);
	});

	it("should migrate toMatchInlineSnapshot with property matchers and snapshot", async (t) => {
		const source = `expect(user).toMatchInlineSnapshot({ id: expect.any(Number) }, \`
{
"id": Any<Number>,
"name": "John"
}
\`);`;
		const result = await workflow(source);
		t.assert.match(result, /t\.assert\.snapshot\(user\)/);
	});

	it("should migrate toMatchInlineSnapshot with simple value", async (t) => {
		const source = 'expect("hello").toMatchInlineSnapshot(\`"hello"\`);';
		const result = await workflow(source);
		t.assert.match(result, /t\.assert\.snapshot\("hello"\)/);
	});

	it("should add t parameter to it with arrow function", async (t) => {
		const source = `it(() => {
				expect(result).toMatchSnapshot();
		});`;
		const result = await workflow(source);
		t.assert.match(result, /it\(\(t\) => \{/);
		t.assert.match(result, /t\.assert\.snapshot\(result\)/);
	});

	it("should add t parameter to it function with unnamed function", async (t) => {
		const source = `it(function() {
				expect(result).toMatchSnapshot();
		});`;
		const result = await workflow(source);
		t.assert.match(result, /it\(function\(t\) \{/);
		t.assert.match(result, /t\.assert\.snapshot\(result\)/);
	});

	it("should add t parameter to it function with named function", async (t) => {
		const source = `it("test", function testFunc() {
				expect(result).toMatchSnapshot();
		});`;
		const result = await workflow(source);
		t.assert.match(result, /it\("test", function testFunc\(t\) \{/);
		t.assert.match(result, /t\.assert\.snapshot\(result\)/);
	});

	it("should add t parameter to it function with options", async (t) => {
		const source = `it({ timeout: 5000 }, () => {
				expect(result).toMatchSnapshot();
		});`;
		const result = await workflow(source);
		t.assert.match(result, /it\(\{ timeout: 5000 \}, \(t\) => \{/);
		t.assert.match(result, /t\.assert\.snapshot\(result\)/);
	});

	it("should add t parameter to it function with name and options", async (t) => {
		const source = `it("test name", { timeout: 5000 }, () => {
				expect(result).toMatchSnapshot();
		});`;
		const result = await workflow(source);
		t.assert.match(result, /it\("test name", \{ timeout: 5000 \}, \(t\) => \{/);
		t.assert.match(result, /t\.assert\.snapshot\(result\)/);
	});

	it("should add t parameter to test function with name", async (t) => {
		const source = `test("test name", () => {
				expect(result).toMatchSnapshot();
		});`;
		const result = await workflow(source);
		t.assert.match(result, /test\("test name", \(t\) => \{/);
		t.assert.match(result, /t\.assert\.snapshot\(result\)/);
	});

	it("should add t parameter to async function", async (t) => {
		const source = `it("async test", async () => {
				expect(result).toMatchSnapshot();
		});`;
		const result = await workflow(source);
		t.assert.match(result, /it\("async test", async \(t\) => \{/);
		t.assert.match(result, /t\.assert\.snapshot\(result\)/);
	});

	it("should not modify test function if t parameter already exists", async (t) => {
		const source = `it("test with t", (t) => {
				expect(result).toMatchSnapshot();
		});`;
		const result = await workflow(source);
		// Should not become (t, t)
		t.assert.match(result, /it\("test with t", \(t\) => \{/);
		t.assert.match(result, /t\.assert\.snapshot\(result\)/);
	});

	it("should only modify direct parent test function for nested tests", async (t) => {
		const source = `it("outer test", () => {
				it("inner test", () => {
						expect(result).toMatchSnapshot();
				});
		});`;
		const result = await workflow(source);
		// Only inner test should get t parameter
		t.assert.match(result, /it\("outer test", \(\) => \{/);
		t.assert.match(result, /it\("inner test", \(t\) => \{/);
		t.assert.match(result, /t\.assert\.snapshot\(result\)/);
	});

	it("should handle multiple snapshots in same test function", async (t) => {
		const source = `it("test with multiple snapshots", () => {
				expect(result1).toMatchSnapshot();
				expect(result2).toMatchInlineSnapshot("inline");
		});`;
		const result = await workflow(source);
		// Should only add t parameter once
		t.assert.match(result, /it\("test with multiple snapshots", \(t\) => \{/);
		t.assert.match(result, /t\.assert\.snapshot\(result1\)/);
		t.assert.match(result, /t\.assert\.snapshot\(result2\)/);
	});

	it("should not modify test functions without snapshots", async (t) => {
		const source = `it("test without snapshots", () => {
				expect(result).toBe(42);
		});`;
		const result = await workflow(source);
		t.assert.match(result, /it\("test without snapshots", \(\) => \{/);
		t.assert.match(result, /expect\(result\)\.toBe\(42\)/);
	});

	it("should handle deeply nested test functions", async (t) => {
		const source = `describe("suite", () => {
				it("outer", () => {
						describe("inner suite", () => {
								it("inner", () => {
										expect(result).toMatchSnapshot();
								});
						});
				});
		});`;
		const result = await workflow(source);
		// Only the innermost test with snapshot should get t parameter
		t.assert.match(result, /it\("outer", \(\) => \{/);
		t.assert.match(result, /it\("inner", \(t\) => \{/);
		t.assert.match(result, /t\.assert\.snapshot\(result\)/);
	});

	it("should migrate jest.useFakeTimers", async (t) => {
		const source = "jest.useFakeTimers();";
		const result = await workflow(source);
		t.assert.match(result, /mock\.timers\.enable\(\)/);
	});

	it("should migrate jest.useRealTimers", async (t) => {
		const source = "jest.useRealTimers();";
		const result = await workflow(source);
		t.assert.match(result, /mock\.timers\.reset\(\)/);
	});

	it("should migrate jest.runAllTicks", async (t) => {
		const source = "jest.runAllTicks();";
		const result = await workflow(source);
		t.assert.match(result, /mock\.timers\.runAll\(\)/);
	});

	it("should migrate jest.runAllTimers", async (t) => {
		const source = "jest.runAllTimers();";
		const result = await workflow(source);
		t.assert.match(result, /mock\.timers\.runAll\(\)/);
	});

	it("should migrate jest.runAllTimersAsync", async (t) => {
		const source = "jest.runAllTimersAsync();";
		const result = await workflow(source);
		t.assert.match(result, /mock\.timers\.runAll\(\)/);
	});

	it("should migrate jest.runAllImmediates", async (t) => {
		const source = "jest.runAllImmediates();";
		const result = await workflow(source);
		t.assert.match(result, /mock\.timers\.runAll\(\)/);
	});

	it("should migrate jest.advanceTimersByTime", async (t) => {
		const source = "jest.advanceTimersByTime(1000);";
		const result = await workflow(source);
		t.assert.match(result, /mock\.timers\.tick\(1000\)/);
	});

	it("should migrate jest.advanceTimersByTimeAsync", async (t) => {
		const source = "jest.advanceTimersByTimeAsync(1000);";
		const result = await workflow(source);
		t.assert.match(result, /mock\.timers\.tick\(1000\)/);
	});

	it("should migrate jest.runOnlyPendingTimers", async (t) => {
		const source = "jest.runOnlyPendingTimers();";
		const result = await workflow(source);
		t.assert.match(result, /mock\.timers\.runAll\(\)/);
	});

	it("should migrate jest.runOnlyPendingTimersAsync", async (t) => {
		const source = "jest.runOnlyPendingTimersAsync();";
		const result = await workflow(source);
		t.assert.match(result, /mock\.timers\.runAll\(\)/);
	});

	it("should migrate jest.clearAllTimers", async (t) => {
		const source = "jest.clearAllTimers();";
		const result = await workflow(source);
		t.assert.match(result, /mock\.timers\.reset\(\)/);
	});

	it("should migrate jest.now", async (t) => {
		const source = "jest.now();";
		const result = await workflow(source);
		t.assert.match(result, /Date\.now\(\)/);
	});

	it("should migrate jest.setSystemTime", async (t) => {
		const source = "jest.setSystemTime(1000);";
		const result = await workflow(source);
		t.assert.match(result, /mock\.timers\.setTime\(Number\(1000\)\)/);
	});

	it("should migrate jest.setSystemTime with variable", async (t) => {
		const source = "jest.setSystemTime(timestamp);";
		const result = await workflow(source);
		t.assert.match(result, /mock\.timers\.setTime\(Number\(timestamp\)\)/);
	});

	it("should migrate jest.advanceTimersByTime with variable", async (t) => {
		const source = "jest.advanceTimersByTime(delay);";
		const result = await workflow(source);
		t.assert.match(result, /mock\.timers\.tick\(delay\)/);
	});
});
