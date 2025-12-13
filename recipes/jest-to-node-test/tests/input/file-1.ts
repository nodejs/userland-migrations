import { describe, it, expect, jest } from "@jest/globals";

describe("test", () => {
	it("should be a test", async () => {
		jest.mock("../fixtures.ts", () => {
			const actual = jest.requireActual("../fixtures.ts");
			return {
				...actual,
				foo: () => "mocked bar",
			};
		});
		const mocked = await import("../fixtures.ts");

		expect(mocked.foo()).toBe("mocked bar");
		expect(mocked.bar()).toBe("baz");

		const a = jest.fn((i: number, j: number) => i + j);
		const b = jest.fn(async (i: number, j: number) => i - j);

		const logSpy = jest.spyOn(console, "log");
		console.log("Hello, world!");

		expect(logSpy.mock.calls[0][0]).toBe("Hello, world!");

		a(1, 1);
		a(2, 2);

		expect(a).toHaveBeenCalled();
		expect(a).toBeCalled();

		expect(a).toHaveBeenCalledTimes(2);
		expect(a).toBeCalledTimes(2);

		expect(a).toHaveBeenCalledWith(1, 1);
		expect(a).toBeCalledWith(1, 1);

		expect(a).toHaveBeenLastCalledWith(2, 2);
		expect(a).lastCalledWith(2, 2);

		expect(a).toHaveBeenNthCalledWith(1, 1, 1);
		expect(a).nthCalledWith(2, 2, 2);

		expect(a).toHaveReturned();
		expect(a).toReturn();

		expect(a).toHaveReturnedTimes(2);
		expect(a).toReturnTimes(2);

		expect(a).toHaveReturnedWith(2);
		expect(a).toReturnWith(4);

		expect(a).toHaveLastReturnedWith(4);
		expect(a).lastReturnedWith(4);

		expect(a).toHaveNthReturnedWith(1, 2);
		expect(a).nthReturnedWith(2, 4);

		a.mock.calls;

		a.mock.results;

		// a.mock.instances;

		// a.mock.contexts;

		a.mock.lastCall;

		a.mockClear();

		a.mockReset();

		a.mockRestore();

		a.mockImplementation((i: number, j: number) => i * j);

		a.mockImplementationOnce((i: number, j: number) => i - j);

		// a.mockName("myMock");

		// a.mockReturnThis();

		a.mockReturnValue(42);

		a.mockReturnValueOnce(42);

		b.mockRejectedValue(new Error("Test error"));

		b.mockRejectedValueOnce(new Error("Test error once"));

		b.mockResolvedValue(42);

		b.mockResolvedValueOnce(42);

		expect({ a: 1 }).toMatchSnapshot();

		expect({ b: 2 }).toMatchInlineSnapshot(`
{
	"b": 2,
}
`);

		jest.useFakeTimers();

		jest.runAllTicks();

		jest.runAllTimers();

		jest.runAllTimersAsync();

		jest.runAllImmediates();

		jest.advanceTimersByTime(1000);

		jest.advanceTimersByTimeAsync(1000);

		jest.runOnlyPendingTimers();

		jest.runOnlyPendingTimersAsync();

		// jest.advanceTimersToNextTimer(5);

		// jest.advanceTimersToNextTimerAsync(5);

		// jest.getTimerCount();

		jest.now();

		jest.setSystemTime(1000);

		jest.useRealTimers();

		jest.useFakeTimers();

		jest.clearAllTimers();

		// jest.getRealSystemTime();
	});
});
