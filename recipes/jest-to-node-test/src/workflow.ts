import { parse, Lang, type Edit, SgNode } from "@ast-grep/napi";

export async function workflow(source: string) {
	const ast = parse(Lang.TypeScript, source);
	const root = ast.root();

	const imports = [
		"describe",
		"it",
		"test",
		"beforeEach",
		"afterEach",
		"beforeAll",
		"afterAll",
	].filter((name) => root.has(`${name}($$$_ARGS)`));
	const hasMocks =
		root.has("jest.mock($$$_ARGS)") ||
		root.has("jest.spyOn($$$_ARGS)") ||
		root.has("jest.fn($$$_ARGS)");
	if (hasMocks) {
		imports.push("mock");
	}

	let importStatement = `import { ${imports.join(", ").replaceAll("All", "")} } from "node:test";\n`;

	const edits: Edit[] = [];
	const addImportsEdit: Edit = { startPos: 0, endPos: 0, insertedText: importStatement };
	edits.push(addImportsEdit);

	const deleteJestImportEdits = root
		.findAll('import { $$$_NAME } from "@jest/globals"\n')
		.map((node) => {
			const edit = node.replace("");
			// FIXME: find another way to include newline
			edit.endPos++;
			return edit;
		});

	const expectPresent = root.has("expect($$$_ARGS)");
	if (expectPresent) {
		addImportsEdit.insertedText += 'import { expect } from "expect";\n';
	}

	const moduleMockEdits = root.findAll("jest.mock($$$ARGS)").map((node) =>
		node.replace(
			`mock.module(${node
				.getMultipleMatches("ARGS")
				.map((n) => n.text())
				.join("")})`,
		),
	);

	const fnMockEdits = root.findAll("jest.fn($$$ARGS)").map((node) =>
		node.replace(
			`mock.fn(${node
				.getMultipleMatches("ARGS")
				.map((node) => node.text())
				.join("")})`,
		),
	);

	const jestSpyOnEdits = root.findAll("jest.spyOn($$$ARGS)").map((node) =>
		node.replace(
			`mock.method(${node
				.getMultipleMatches("ARGS")
				.map((node) => node.text())
				.join("")})`,
		),
	);

	const toHaveBeenCalledEdits = root
		.findAll("expect($ACTUAL).toHaveBeenCalled()")
		.map((node) =>
			node.replace(`expect(${node.getMatch("ACTUAL")?.text()}.mock.callCount()).toBeTruthy()`),
		);

	const toBeCalledEdits = root
		.findAll("expect($ACTUAL).toBeCalled()")
		.map((node) =>
			node.replace(`expect(${node.getMatch("ACTUAL")?.text()}.mock.callCount()).toBeTruthy()`),
		);

	const toHaveBeenCalledTimesEdits = root
		.findAll("expect($ACTUAL).toHaveBeenCalledTimes($TIMES)")
		.map((node) =>
			node.replace(
				`expect(${node.getMatch("ACTUAL")?.text()}.mock.callCount()).toBe(${node.getMatch("TIMES")?.text()})`,
			),
		);

	const toBeCalledTimesEdits = root
		.findAll("expect($ACTUAL).toBeCalledTimes($TIMES)")
		.map((node) =>
			node.replace(
				`expect(${node.getMatch("ACTUAL")?.text()}.mock.callCount()).toBe(${node.getMatch("TIMES")?.text()})`,
			),
		);

	const toHaveBeenCalledWithEdits = root
		.findAll("expect($ACTUAL).toHaveBeenCalledWith($$$ARGS)")
		.map((node) =>
			node.replace(
				`expect(${node.getMatch("ACTUAL")?.text()}.mock.calls.map(call => call.arguments)).toContainEqual([${node
					.getMultipleMatches("ARGS")
					.map((n) => n.text())
					.join("")}])`,
			),
		);

	const toBeCalledWithEdits = root.findAll("expect($ACTUAL).toBeCalledWith($$$ARGS)").map((node) =>
		node.replace(
			`expect(${node.getMatch("ACTUAL")?.text()}.mock.calls.map(call => call.arguments)).toContainEqual([${node
				.getMultipleMatches("ARGS")
				.map((n) => n.text())
				.join("")}])`,
		),
	);

	const toHaveBeenLastCalledWithEdits = root
		.findAll("expect($ACTUAL).toHaveBeenLastCalledWith($$$ARGS)")
		.map((node) =>
			node.replace(
				`expect(${node.getMatch("ACTUAL")?.text()}.mock.calls.at(-1)?.arguments).toStrictEqual([${node
					.getMultipleMatches("ARGS")
					.map((n) => n.text())
					.join("")}])`,
			),
		);

	const lastCalledWithEdits = root.findAll("expect($ACTUAL).lastCalledWith($$$ARGS)").map((node) =>
		node.replace(
			`expect(${node.getMatch("ACTUAL")?.text()}.mock.calls.at(-1)?.arguments).toStrictEqual([${node
				.getMultipleMatches("ARGS")
				.map((n) => n.text())
				.join("")}])`,
		),
	);

	const toHaveBeenNthCalledWithEdits = root
		.findAll("expect($ACTUAL).toHaveBeenNthCalledWith($INDEX, $$$ARGS)")
		.map((node) =>
			node.replace(
				`expect(${node.getMatch("ACTUAL")?.text()}.mock.calls[${parseInt(node.getMatch("INDEX")?.text() || "0") - 1}].arguments).toStrictEqual([${node
					.getMultipleMatches("ARGS")
					.map((n) => n.text())
					.join("")}])`,
			),
		);

	const nthCalledWithEdits = root
		.findAll("expect($ACTUAL).nthCalledWith($INDEX, $$$ARGS)")
		.map((node) =>
			node.replace(
				`expect(${node.getMatch("ACTUAL")?.text()}.mock.calls[${parseInt(node.getMatch("INDEX")?.text() || "0") - 1}].arguments).toStrictEqual([${node
					.getMultipleMatches("ARGS")
					.map((n) => n.text())
					.join("")}])`,
			),
		);

	const toHaveReturnedEdits = root
		.findAll("expect($ACTUAL).toHaveReturned()")
		.map((node) =>
			node.replace(
				`expect(${node.getMatch("ACTUAL")?.text()}.mock.calls.some(call => call.error === undefined)).toBeTruthy()`,
			),
		);

	const toReturnEdits = root
		.findAll("expect($ACTUAL).toReturn()")
		.map((node) =>
			node.replace(
				`expect(${node.getMatch("ACTUAL")?.text()}.mock.calls.some(call => call.error === undefined)).toBeTruthy()`,
			),
		);

	const toHaveReturnedTimesEdits = root
		.findAll("expect($ACTUAL).toHaveReturnedTimes($TIMES)")
		.map((node) =>
			node.replace(
				`expect(${node.getMatch("ACTUAL")?.text()}.mock.calls.filter(call => call.error === undefined)).toHaveLength(${node.getMatch("TIMES")?.text()})`,
			),
		);

	const toReturnTimesEdits = root
		.findAll("expect($ACTUAL).toReturnTimes($TIMES)")
		.map((node) =>
			node.replace(
				`expect(${node.getMatch("ACTUAL")?.text()}.mock.calls.filter(call => call.error === undefined)).toHaveLength(${node.getMatch("TIMES")?.text()})`,
			),
		);

	const toHaveReturnedWithEdits = root
		.findAll("expect($ACTUAL).toHaveReturnedWith($VALUE)")
		.map((node) =>
			node.replace(
				`expect(${node.getMatch("ACTUAL")?.text()}.mock.calls.map(call => call.result)).toContainEqual(${node.getMatch("VALUE")?.text()})`,
			),
		);

	const toReturnWithEdits = root
		.findAll("expect($ACTUAL).toReturnWith($VALUE)")
		.map((node) =>
			node.replace(
				`expect(${node.getMatch("ACTUAL")?.text()}.mock.calls.map(call => call.result)).toContainEqual(${node.getMatch("VALUE")?.text()})`,
			),
		);

	const toHaveLastReturnedWithEdits = root
		.findAll("expect($ACTUAL).toHaveLastReturnedWith($VALUE)")
		.map((node) =>
			node.replace(
				`expect(${node.getMatch("ACTUAL")?.text()}.mock.calls.at(-1)?.result).toBe(${node.getMatch("VALUE")?.text()})`,
			),
		);

	const lastReturnedWithEdits = root
		.findAll("expect($ACTUAL).lastReturnedWith($VALUE)")
		.map((node) =>
			node.replace(
				`expect(${node.getMatch("ACTUAL")?.text()}.mock.calls.at(-1)?.result).toBe(${node.getMatch("VALUE")?.text()})`,
			),
		);

	const toHaveNthReturnedWithEdits = root
		.findAll("expect($ACTUAL).toHaveNthReturnedWith($INDEX, $VALUE)")
		.map((node) =>
			node.replace(
				`expect(${node.getMatch("ACTUAL")?.text()}.mock.calls[${parseInt(node.getMatch("INDEX")?.text() || "0") - 1}].result).toBe(${node.getMatch("VALUE")?.text()})`,
			),
		);

	const nthReturnedWithEdits = root
		.findAll("expect($ACTUAL).nthReturnedWith($INDEX, $VALUE)")
		.map((node) =>
			node.replace(
				`expect(${node.getMatch("ACTUAL")?.text()}.mock.calls[${parseInt(node.getMatch("INDEX")?.text() || "0") - 1}].result).toBe(${node.getMatch("VALUE")?.text()})`,
			),
		);

	const mockCallsEdits = root
		.findAll("$MOCK.mock.calls")
		.map((node) =>
			node.replace(`${node.getMatch("MOCK")?.text()}.mock.calls.map((call) => call.arguments)`),
		);

	// TODO: Consider other possible translations
	const mockResultsEdits = root.findAll("$MOCK.mock.results").map((node) =>
		node.replace(`${node.getMatch("MOCK")?.text()}.mock.calls.map((call) => ({
	type: call.error ? "throw" : "return",
	value: call.error ? call.error : call.result,
}))`),
	);

	// TODO: Consider if instances are translatable

	// TODO: Consider if contexts are translatable

	// TODO: Consider case where it wasn't called and result is undefined
	const mockLastCallEdits = root
		.findAll("$MOCK.mock.lastCall")
		.map((node) => node.replace(`${node.getMatch("MOCK")?.text()}.mock.calls.at(-1)?.arguments`));

	const mockClearEdits = root
		.findAll("$MOCK.mockClear()")
		.map((node) => node.replace(`${node.getMatch("MOCK")?.text()}.mock.resetCalls()`));

	// TODO: consider doing something like a.mock.mockImplementation((...args: unknown[]) => {}); for consistent behavior
	const mockResetEdits = root
		.findAll("$MOCK.mockReset()")
		.map((node) => node.replace(`${node.getMatch("MOCK")?.text()}.mock.restore()`));

	const mockRestoreEdits = root
		.findAll("$MOCK.mockRestore()")
		.map((node) => node.replace(`${node.getMatch("MOCK")?.text()}.mock.restore()`));

	// TODO: Consider deleting mockName

	// TODO: consider doing `a.mock.mockImplementation(function () { return this; });` for mockReturnThis

	const mockImplementationEdits = root
		.findAll("$MOCK.mockImplementation($IMPLEMENTATION)")
		.map((node) => {
			const mock = node.getMatch("MOCK")?.text();
			const implementation = node.getMatch("IMPLEMENTATION")?.text();
			return node.replace(`${mock}.mock.mockImplementation(${implementation})`);
		});

	const mockImplementationOnceEdits = root
		.findAll("$MOCK.mockImplementationOnce($IMPLEMENTATION)")
		.map((node) => {
			const mock = node.getMatch("MOCK")?.text();
			const implementation = node.getMatch("IMPLEMENTATION")?.text();
			return node.replace(`${mock}.mock.mockImplementationOnce(${implementation})`);
		});

	const mockReturnValueEdits = root.findAll("$MOCK.mockReturnValue($VALUE)").map((node) => {
		const mock = node.getMatch("MOCK")?.text();
		const value = node.getMatch("VALUE")?.text();
		return node.replace(`${mock}.mock.mockImplementation(() => ${value})`);
	});

	const mockReturnValueOnceEdits = root.findAll("$MOCK.mockReturnValueOnce($VALUE)").map((node) => {
		const mock = node.getMatch("MOCK")?.text();
		const value = node.getMatch("VALUE")?.text();
		return node.replace(`${mock}.mock.mockImplementationOnce(() => ${value})`);
	});

	const mockRejectedValueEdits = root.findAll("$MOCK.mockRejectedValue($ERROR)").map((node) => {
		const mock = node.getMatch("MOCK")?.text();
		const error = node.getMatch("ERROR")?.text();
		return node.replace(`${mock}.mock.mockImplementation(async () => {
	throw ${error};
})`);
	});

	const mockRejectedValueOnceEdits = root
		.findAll("$MOCK.mockRejectedValueOnce($ERROR)")
		.map((node) => {
			const mock = node.getMatch("MOCK")?.text();
			const error = node.getMatch("ERROR")?.text();
			return node.replace(`${mock}.mock.mockImplementationOnce(async () => {
	throw ${error};
})`);
		});

	const mockResolvedValueEdits = root.findAll("$MOCK.mockResolvedValue($VALUE)").map((node) => {
		const mock = node.getMatch("MOCK")?.text();
		const value = node.getMatch("VALUE")?.text();
		return node.replace(`${mock}.mock.mockImplementation(async () => ${value})`);
	});

	const mockResolvedValueOnceEdits = root
		.findAll("$MOCK.mockResolvedValueOnce($VALUE)")
		.map((node) => {
			const mock = node.getMatch("MOCK")?.text();
			const value = node.getMatch("VALUE")?.text();
			return node.replace(`${mock}.mock.mockImplementationOnce(async () => ${value})`);
		});

	let snapshotNodes: SgNode[] = [];

	// TODO: Consider if translation of matchers is possible
	const toMatchSnapshotEdits = root
		.findAll("expect($ACTUAL).toMatchSnapshot($$$_ARGS)")
		.map((node) => {
			snapshotNodes.push(node);
			const actual = node.getMatch("ACTUAL")?.text();
			return node.replace(`t.assert.snapshot(${actual})`);
		});

	// TODO: Consider if translation of matchers is possible
	const toMatchInlineSnapshotEdits = root
		.findAll("expect($ACTUAL).toMatchInlineSnapshot($$$_ARGS)")
		.map((node) => {
			snapshotNodes.push(node);
			const actual = node.getMatch("ACTUAL")?.text();
			// For inline snapshots, we ignore the snapshot content and just use t.assert.snapshot
			return node.replace(`t.assert.snapshot(${actual})`);
		});

	// TODO: Avoid changing the same node multiple times
	const testArgumentEdits = snapshotNodes
		.map((node) => {
			const ancestor = node.ancestors().find((a) => a.kind() === "call_expression");
			const child = ancestor?.field("arguments");
			const grandChild = child
				?.children()
				.find((c) => c.kind() === "arrow_function" || c.kind() === "function_expression");
			return grandChild?.field("parameters")?.replace("(t)");
		})
		.filter((edit) => edit !== undefined);

	const jestUseFakeTimersEdits = root
		.findAll("jest.useFakeTimers()")
		.map((node) => node.replace("mock.timers.enable()"));

	const jestUseRealTimersEdits = root
		.findAll("jest.useRealTimers()")
		.map((node) => node.replace("mock.timers.reset()"));

	// TODO: Check if we can do this the run all recursively to match behavior
	// TODO: Check if we can run only microtasks
	const jestRunAllTicksEdits = root
		.findAll("jest.runAllTicks()")
		.map((node) => node.replace("mock.timers.runAll()"));

	const jestRunAllTimersEdits = root
		.findAll("jest.runAllTimers()")
		.map((node) => node.replace("mock.timers.runAll()"));

	// FIXME: Potentially incorrect if used with await/promise chaining
	const jestRunAllTimersAsyncEdits = root
		.findAll("jest.runAllTimersAsync()")
		.map((node) => node.replace("mock.timers.runAll()"));

	// TODO: Check if we can run only immediates
	const jestRunAllImmediatesEdits = root
		.findAll("jest.runAllImmediates()")
		.map((node) => node.replace("mock.timers.runAll()"));

	const jestAdvanceTimersByTimeEdits = root
		.findAll("jest.advanceTimersByTime($TIME)")
		.map((node) => {
			const time = node.getMatch("TIME")?.text();
			return node.replace(`mock.timers.tick(${time})`);
		});

	// FIXME: Potentially incorrect if used with await/promise chaining
	const jestAdvanceTimersByTimeAsyncEdits = root
		.findAll("jest.advanceTimersByTimeAsync($TIME)")
		.map((node) => {
			const time = node.getMatch("TIME")?.text();
			return node.replace(`mock.timers.tick(${time})`);
		});

	const jestRunOnlyPendingTimersEdits = root
		.findAll("jest.runOnlyPendingTimers()")
		.map((node) => node.replace("mock.timers.runAll()"));

	const jestRunOnlyPendingTimersAsyncEdits = root
		.findAll("jest.runOnlyPendingTimersAsync()")
		.map((node) => node.replace("mock.timers.runAll()"));

	// TODO: Consider if advanceToNextTimer is translatable

	// TODO: Consider if advanceToNextTimerAsync is translatable

	const jestClearAllTimersEdits = root
		.findAll("jest.clearAllTimers()")
		.map((node) => node.replace("mock.timers.reset()"));

	// TODO: Consider if getTimerCount is translatable"

	const jestNowEdits = root.findAll("jest.now()").map((node) => node.replace("Date.now()"));

	const jestSetSystemTimeEdits = root.findAll("jest.setSystemTime($TIME)").map((node) => {
		const time = node.getMatch("TIME")?.text();
		// FIXME: Hack to work with Date and number
		return node.replace(`mock.timers.setTime(Number(${time}))`);
	});

	// TODO: Consider if getRealSystemTime is translatable

	edits.push(
		...deleteJestImportEdits,
		...moduleMockEdits,
		...fnMockEdits,
		...jestSpyOnEdits,
		...toHaveBeenCalledEdits,
		...toBeCalledEdits,
		...toHaveBeenCalledTimesEdits,
		...toBeCalledTimesEdits,
		...toHaveBeenCalledWithEdits,
		...toBeCalledWithEdits,
		...toHaveBeenLastCalledWithEdits,
		...lastCalledWithEdits,
		...toHaveBeenNthCalledWithEdits,
		...nthCalledWithEdits,
		...toHaveReturnedEdits,
		...toReturnEdits,
		...toHaveReturnedTimesEdits,
		...toReturnTimesEdits,
		...toHaveReturnedWithEdits,
		...toReturnWithEdits,
		...toHaveLastReturnedWithEdits,
		...lastReturnedWithEdits,
		...toHaveNthReturnedWithEdits,
		...nthReturnedWithEdits,
		...mockCallsEdits,
		...mockResultsEdits,
		...mockLastCallEdits,
		...mockClearEdits,
		...mockResetEdits,
		...mockRestoreEdits,
		...mockImplementationEdits,
		...mockImplementationOnceEdits,
		...mockReturnValueEdits,
		...mockReturnValueOnceEdits,
		...mockRejectedValueEdits,
		...mockRejectedValueOnceEdits,
		...mockResolvedValueEdits,
		...mockResolvedValueOnceEdits,
		...jestUseFakeTimersEdits,
		...jestUseRealTimersEdits,
		...jestRunAllTicksEdits,
		...jestRunAllTimersEdits,
		...jestRunAllTimersAsyncEdits,
		...jestRunAllImmediatesEdits,
		...jestAdvanceTimersByTimeEdits,
		...jestAdvanceTimersByTimeAsyncEdits,
		...jestRunOnlyPendingTimersEdits,
		...jestRunOnlyPendingTimersAsyncEdits,
		...jestClearAllTimersEdits,
		...jestNowEdits,
		...jestSetSystemTimeEdits,
		...toMatchSnapshotEdits,
		...toMatchInlineSnapshotEdits,
		...testArgumentEdits,
	);

	return root.commitEdits(edits);
}
