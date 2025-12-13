import { describe, it, mock } from "node:test";
import { expect } from "expect";

describe("test", () => {
	it("should be a test", async (t) => {
		const mockFactory = async () => {
			const actual = await import("../fixtures.ts");
			return {
			...actual,
			foo: () => 'mocked bar',
			}
		};

		mock.module("../fixtures.ts", {
			namedExports: await mockFactory(),
		});
		const mocked = await import("../fixtures.ts");
		
		expect(mocked.foo()).toBe('mocked bar');
		expect(mocked.bar()).toBe('baz');

		const a = mock.fn((i: number, j: number) => i + j);
		const b = mock.fn(async (i: number, j: number) => i - j);

		const logSpy = mock.method(console,"log");
		console.log("Hello, world!");

		expect(logSpy.mock.calls.map((call) => call.arguments)[0][0]).toBe("Hello, world!");

		a(1, 1);
		a(2, 2);

		expect(a.mock.callCount()).toBeTruthy();
		expect(a.mock.callCount()).toBeTruthy();

		expect(a.mock.callCount()).toBe(2);
		expect(a.mock.callCount()).toBe(2);

		expect(a.mock.calls.map(call => call.arguments)).toContainEqual([1,1]);
		expect(a.mock.calls.map(call => call.arguments)).toContainEqual([1,1]);

		expect(a.mock.calls.at(-1)?.arguments).toStrictEqual([2,2]);
		expect(a.mock.calls.at(-1)?.arguments).toStrictEqual([2,2]);

		expect(a.mock.calls[0].arguments).toStrictEqual([1,1]);
		expect(a.mock.calls[1].arguments).toStrictEqual([2,2]);

		expect(a.mock.calls.some(call => call.error === undefined)).toBeTruthy();
		expect(a.mock.calls.some(call => call.error === undefined)).toBeTruthy();

		expect(a.mock.calls.filter(call => call.error === undefined)).toHaveLength(2);
		expect(a.mock.calls.filter(call => call.error === undefined)).toHaveLength(2);

		expect(a.mock.calls.map(call => call.result)).toContainEqual(2);
		expect(a.mock.calls.map(call => call.result)).toContainEqual(4);

		expect(a.mock.calls.at(-1)?.result).toBe(4);
		expect(a.mock.calls.at(-1)?.result).toBe(4);

		expect(a.mock.calls[0].result).toBe(2);
		expect(a.mock.calls[1].result).toBe(4);

		a.mock.calls.map((call) => call.arguments);

		a.mock.calls.map((call) => ({
			type: call.error ? "throw" : "return",
			value: call.error ? call.error : call.result,
		}));

		// a.mock.instances;

		// a.mock.contexts;

		a.mock.calls.at(-1)?.arguments;

		a.mock.resetCalls();

		a.mock.restore();

		a.mock.restore();

		a.mock.mockImplementation((i: number, j: number) => i * j);

		a.mock.mockImplementationOnce((i: number, j: number) => i - j);

		// a.mockName("myMock");

		// a.mockReturnThis();

		a.mock.mockImplementation(() => 42);

		a.mock.mockImplementationOnce(() => 42);

		b.mock.mockImplementation(async () => {
			throw new Error("Test error");
		});

		b.mock.mockImplementationOnce(async () => {
			throw new Error("Test error once");
		});

		b.mock.mockImplementation(async () => 42);

		b.mock.mockImplementationOnce(async () => 42);

		t.assert.snapshot({ a: 1 });

		t.assert.snapshot({ b: 2 });

		mock.timers.enable();

		mock.timers.runAll();

		mock.timers.runAll();

		mock.timers.runAll();

		mock.timers.runAll();

		mock.timers.tick(1000);

		mock.timers.tick(1000);

		mock.timers.runAll();

		mock.timers.runAll();

		// jest.advanceTimersToNextTimer(5);

		// jest.advanceTimersToNextTimerAsync(5);

		// jest.getTimerCount();

		Date.now();

		mock.timers.setTime(Number(1000));

		mock.timers.reset();

		mock.timers.enable();

		mock.timers.reset();

		// jest.getRealSystemTime();
	});
});
