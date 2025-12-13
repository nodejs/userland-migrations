import type { SgRoot, SgNode, Edit } from "@codemod.com/jssg-types/main";

function getIndent(node: SgNode, rootNode: SgNode): string {
	const range = node.range();
	const sourceCode = rootNode.text();
	const lines = sourceCode.split("\n");
	const lineText = lines[range.start.line];
	return lineText.match(/^(\s*)/)?.[1] || "";
}

export default async function transform(root: SgRoot) {
	const rootNode = root.root();
	const imports = [
		"describe",
		"it",
		"test",
		"beforeEach",
		"afterEach",
		"beforeAll",
		"afterAll",
	].filter((name) => rootNode.has(`${name}($$$_ARGS)`));
	const hasMocks =
		rootNode.has("jest.mock($$$_ARGS)") ||
		rootNode.has("jest.spyOn($$$_ARGS)") ||
		rootNode.has("jest.fn($$$_ARGS)");
	if (hasMocks) {
		imports.push("mock");
	}

	let importStatement = `import { ${imports.join(", ").replaceAll("All", "")} } from "node:test";\n`;

	const edits: Edit[] = [];
	const addImportsEdit: Edit = {
		startPos: 0,
		endPos: 0,
		insertedText: importStatement,
	};
	edits.push(addImportsEdit);

	const deleteJestImportEdits = rootNode
		.findAll('import { $$$_NAME } from "@jest/globals"\n')
		.map((node) => {
			const edit = node.replace("");
			// FIXME: find another way to include newline
			edit.endPos++;
			return edit;
		});

	const expectPresent = rootNode.has("expect($$$_ARGS)");
	if (expectPresent) {
		addImportsEdit.insertedText += 'import { expect } from "expect";\n';
	}

	const requireActualEdits = rootNode.findAll("jest.requireActual($$$ARGS)").map((node) => {
		const args = node
			.getMultipleMatches("ARGS")
			.map((n) => n.text())
			.join("");
		return node.replace(`await import(${args})`);
	});

	const moduleMockWithFactoryEdits = rootNode.findAll("jest.mock($PATH, $FACTORY)").map((node) => {
		const path = node.getMatch("PATH")?.text();
		const factory = node.getMatch("FACTORY");
		const indent = getIndent(node, rootNode);

		if (!factory) {
			return node.replace(`mock.module(${path})`);
		}

		let factoryText = factory.text();

		return node.replace(
			`const mockFactory = async ${factoryText};\n\n${indent}mock.module(${path}, {\n${indent}\tnamedExports: await mockFactory(),\n${indent}})`,
		);
	});

	const fnMockEdits = rootNode.findAll("jest.fn($$$ARGS)").map((node) =>
		node.replace(
			`mock.fn(${node
				.getMultipleMatches("ARGS")
				.map((node) => node.text())
				.join("")})`,
		),
	);

	const jestSpyOnEdits = rootNode.findAll("jest.spyOn($$$ARGS)").map((node) =>
		node.replace(
			`mock.method(${node
				.getMultipleMatches("ARGS")
				.map((node) => node.text())
				.join("")})`,
		),
	);

	const toHaveBeenCalledEdits = rootNode
		.findAll("expect($ACTUAL).toHaveBeenCalled()")
		.map((node) =>
			node.replace(`expect(${node.getMatch("ACTUAL")?.text()}.mock.callCount()).toBeTruthy()`),
		);

	const toBeCalledEdits = rootNode
		.findAll("expect($ACTUAL).toBeCalled()")
		.map((node) =>
			node.replace(`expect(${node.getMatch("ACTUAL")?.text()}.mock.callCount()).toBeTruthy()`),
		);

	const toHaveBeenCalledTimesEdits = rootNode
		.findAll("expect($ACTUAL).toHaveBeenCalledTimes($TIMES)")
		.map((node) =>
			node.replace(
				`expect(${node.getMatch("ACTUAL")?.text()}.mock.callCount()).toBe(${node.getMatch("TIMES")?.text()})`,
			),
		);

	const toBeCalledTimesEdits = rootNode
		.findAll("expect($ACTUAL).toBeCalledTimes($TIMES)")
		.map((node) =>
			node.replace(
				`expect(${node.getMatch("ACTUAL")?.text()}.mock.callCount()).toBe(${node.getMatch("TIMES")?.text()})`,
			),
		);

	const toHaveBeenCalledWithEdits = rootNode
		.findAll("expect($ACTUAL).toHaveBeenCalledWith($$$ARGS)")
		.map((node) =>
			node.replace(
				`expect(${node.getMatch("ACTUAL")?.text()}.mock.calls.map(call => call.arguments)).toContainEqual([${node
					.getMultipleMatches("ARGS")
					.map((n) => n.text())
					.join("")}])`,
			),
		);

	const toBeCalledWithEdits = rootNode
		.findAll("expect($ACTUAL).toBeCalledWith($$$ARGS)")
		.map((node) =>
			node.replace(
				`expect(${node.getMatch("ACTUAL")?.text()}.mock.calls.map(call => call.arguments)).toContainEqual([${node
					.getMultipleMatches("ARGS")
					.map((n) => n.text())
					.join("")}])`,
			),
		);

	const toHaveBeenLastCalledWithEdits = rootNode
		.findAll("expect($ACTUAL).toHaveBeenLastCalledWith($$$ARGS)")
		.map((node) =>
			node.replace(
				`expect(${node.getMatch("ACTUAL")?.text()}.mock.calls.at(-1)?.arguments).toStrictEqual([${node
					.getMultipleMatches("ARGS")
					.map((n) => n.text())
					.join("")}])`,
			),
		);

	const lastCalledWithEdits = rootNode
		.findAll("expect($ACTUAL).lastCalledWith($$$ARGS)")
		.map((node) =>
			node.replace(
				`expect(${node.getMatch("ACTUAL")?.text()}.mock.calls.at(-1)?.arguments).toStrictEqual([${node
					.getMultipleMatches("ARGS")
					.map((n) => n.text())
					.join("")}])`,
			),
		);

	const toHaveBeenNthCalledWithEdits = rootNode
		.findAll("expect($ACTUAL).toHaveBeenNthCalledWith($INDEX, $$$ARGS)")
		.map((node) =>
			node.replace(
				`expect(${node.getMatch("ACTUAL")?.text()}.mock.calls[${parseInt(node.getMatch("INDEX")?.text() || "0") - 1}].arguments).toStrictEqual([${node
					.getMultipleMatches("ARGS")
					.map((n) => n.text())
					.join("")}])`,
			),
		);

	const nthCalledWithEdits = rootNode
		.findAll("expect($ACTUAL).nthCalledWith($INDEX, $$$ARGS)")
		.map((node) =>
			node.replace(
				`expect(${node.getMatch("ACTUAL")?.text()}.mock.calls[${parseInt(node.getMatch("INDEX")?.text() || "0") - 1}].arguments).toStrictEqual([${node
					.getMultipleMatches("ARGS")
					.map((n) => n.text())
					.join("")}])`,
			),
		);

	const toHaveReturnedEdits = rootNode
		.findAll("expect($ACTUAL).toHaveReturned()")
		.map((node) =>
			node.replace(
				`expect(${node.getMatch("ACTUAL")?.text()}.mock.calls.some(call => call.error === undefined)).toBeTruthy()`,
			),
		);

	const toReturnEdits = rootNode
		.findAll("expect($ACTUAL).toReturn()")
		.map((node) =>
			node.replace(
				`expect(${node.getMatch("ACTUAL")?.text()}.mock.calls.some(call => call.error === undefined)).toBeTruthy()`,
			),
		);

	const toHaveReturnedTimesEdits = rootNode
		.findAll("expect($ACTUAL).toHaveReturnedTimes($TIMES)")
		.map((node) =>
			node.replace(
				`expect(${node.getMatch("ACTUAL")?.text()}.mock.calls.filter(call => call.error === undefined)).toHaveLength(${node.getMatch("TIMES")?.text()})`,
			),
		);

	const toReturnTimesEdits = rootNode
		.findAll("expect($ACTUAL).toReturnTimes($TIMES)")
		.map((node) =>
			node.replace(
				`expect(${node.getMatch("ACTUAL")?.text()}.mock.calls.filter(call => call.error === undefined)).toHaveLength(${node.getMatch("TIMES")?.text()})`,
			),
		);

	const toHaveReturnedWithEdits = rootNode
		.findAll("expect($ACTUAL).toHaveReturnedWith($VALUE)")
		.map((node) =>
			node.replace(
				`expect(${node.getMatch("ACTUAL")?.text()}.mock.calls.map(call => call.result)).toContainEqual(${node.getMatch("VALUE")?.text()})`,
			),
		);

	const toReturnWithEdits = rootNode
		.findAll("expect($ACTUAL).toReturnWith($VALUE)")
		.map((node) =>
			node.replace(
				`expect(${node.getMatch("ACTUAL")?.text()}.mock.calls.map(call => call.result)).toContainEqual(${node.getMatch("VALUE")?.text()})`,
			),
		);

	const toHaveLastReturnedWithEdits = rootNode
		.findAll("expect($ACTUAL).toHaveLastReturnedWith($VALUE)")
		.map((node) =>
			node.replace(
				`expect(${node.getMatch("ACTUAL")?.text()}.mock.calls.at(-1)?.result).toBe(${node.getMatch("VALUE")?.text()})`,
			),
		);

	const lastReturnedWithEdits = rootNode
		.findAll("expect($ACTUAL).lastReturnedWith($VALUE)")
		.map((node) =>
			node.replace(
				`expect(${node.getMatch("ACTUAL")?.text()}.mock.calls.at(-1)?.result).toBe(${node.getMatch("VALUE")?.text()})`,
			),
		);

	const toHaveNthReturnedWithEdits = rootNode
		.findAll("expect($ACTUAL).toHaveNthReturnedWith($INDEX, $VALUE)")
		.map((node) =>
			node.replace(
				`expect(${node.getMatch("ACTUAL")?.text()}.mock.calls[${parseInt(node.getMatch("INDEX")?.text() || "0") - 1}].result).toBe(${node.getMatch("VALUE")?.text()})`,
			),
		);

	const nthReturnedWithEdits = rootNode
		.findAll("expect($ACTUAL).nthReturnedWith($INDEX, $VALUE)")
		.map((node) =>
			node.replace(
				`expect(${node.getMatch("ACTUAL")?.text()}.mock.calls[${parseInt(node.getMatch("INDEX")?.text() || "0") - 1}].result).toBe(${node.getMatch("VALUE")?.text()})`,
			),
		);

	const mockCallsEdits = rootNode
		.findAll("$MOCK.mock.calls")
		.map((node) =>
			node.replace(`${node.getMatch("MOCK")?.text()}.mock.calls.map((call) => call.arguments)`),
		);

	// TODO: Consider other possible translations
	const mockResultsEdits = rootNode.findAll("$MOCK.mock.results").map((node) => {
		const mock = node.getMatch("MOCK")?.text();
		const indent = getIndent(node, rootNode);

		return node.replace(`${mock}.mock.calls.map((call) => ({
${indent}\ttype: call.error ? "throw" : "return",
${indent}\tvalue: call.error ? call.error : call.result,
${indent}}))`);
	});

	// TODO: Consider if instances are translatable

	// TODO: Consider if contexts are translatable

	// TODO: Consider case where it wasn't called and result is undefined
	const mockLastCallEdits = rootNode
		.findAll("$MOCK.mock.lastCall")
		.map((node) => node.replace(`${node.getMatch("MOCK")?.text()}.mock.calls.at(-1)?.arguments`));

	const mockClearEdits = rootNode
		.findAll("$MOCK.mockClear()")
		.map((node) => node.replace(`${node.getMatch("MOCK")?.text()}.mock.resetCalls()`));

	// TODO: consider doing something like a.mock.mockImplementation((...args: unknown[]) => {}); for consistent behavior
	const mockResetEdits = rootNode
		.findAll("$MOCK.mockReset()")
		.map((node) => node.replace(`${node.getMatch("MOCK")?.text()}.mock.restore()`));

	const mockRestoreEdits = rootNode
		.findAll("$MOCK.mockRestore()")
		.map((node) => node.replace(`${node.getMatch("MOCK")?.text()}.mock.restore()`));

	// TODO: Consider deleting mockName

	// TODO: consider doing `a.mock.mockImplementation(function () { return this; });` for mockReturnThis

	const mockImplementationEdits = rootNode
		.findAll("$MOCK.mockImplementation($IMPLEMENTATION)")
		.map((node) => {
			const mock = node.getMatch("MOCK")?.text();
			const implementation = node.getMatch("IMPLEMENTATION")?.text();
			return node.replace(`${mock}.mock.mockImplementation(${implementation})`);
		});

	const mockImplementationOnceEdits = rootNode
		.findAll("$MOCK.mockImplementationOnce($IMPLEMENTATION)")
		.map((node) => {
			const mock = node.getMatch("MOCK")?.text();
			const implementation = node.getMatch("IMPLEMENTATION")?.text();
			return node.replace(`${mock}.mock.mockImplementationOnce(${implementation})`);
		});

	const mockReturnValueEdits = rootNode.findAll("$MOCK.mockReturnValue($VALUE)").map((node) => {
		const mock = node.getMatch("MOCK")?.text();
		const value = node.getMatch("VALUE")?.text();
		return node.replace(`${mock}.mock.mockImplementation(() => ${value})`);
	});

	const mockReturnValueOnceEdits = rootNode
		.findAll("$MOCK.mockReturnValueOnce($VALUE)")
		.map((node) => {
			const mock = node.getMatch("MOCK")?.text();
			const value = node.getMatch("VALUE")?.text();
			return node.replace(`${mock}.mock.mockImplementationOnce(() => ${value})`);
		});

	const mockRejectedValueEdits = rootNode.findAll("$MOCK.mockRejectedValue($ERROR)").map((node) => {
		const mock = node.getMatch("MOCK")?.text();
		const error = node.getMatch("ERROR")?.text();
		const indent = getIndent(node, rootNode);

		return node.replace(`${mock}.mock.mockImplementation(async () => {
${indent}\tthrow ${error};
${indent}})`);
	});

	const mockRejectedValueOnceEdits = rootNode
		.findAll("$MOCK.mockRejectedValueOnce($ERROR)")
		.map((node) => {
			const mock = node.getMatch("MOCK")?.text();
			const error = node.getMatch("ERROR")?.text();
			const indent = getIndent(node, rootNode);

			return node.replace(`${mock}.mock.mockImplementationOnce(async () => {
${indent}\tthrow ${error};
${indent}})`);
		});

	const mockResolvedValueEdits = rootNode.findAll("$MOCK.mockResolvedValue($VALUE)").map((node) => {
		const mock = node.getMatch("MOCK")?.text();
		const value = node.getMatch("VALUE")?.text();
		return node.replace(`${mock}.mock.mockImplementation(async () => ${value})`);
	});

	const mockResolvedValueOnceEdits = rootNode
		.findAll("$MOCK.mockResolvedValueOnce($VALUE)")
		.map((node) => {
			const mock = node.getMatch("MOCK")?.text();
			const value = node.getMatch("VALUE")?.text();
			return node.replace(`${mock}.mock.mockImplementationOnce(async () => ${value})`);
		});

	let snapshotNodes: SgNode[] = [];

	// TODO: Consider if translation of matchers is possible
	const toMatchSnapshotEdits = rootNode
		.findAll("expect($ACTUAL).toMatchSnapshot($$$_ARGS)")
		.map((node) => {
			snapshotNodes.push(node);
			const actual = node.getMatch("ACTUAL")?.text();
			return node.replace(`t.assert.snapshot(${actual})`);
		});

	// TODO: Consider if translation of matchers is possible
	const toMatchInlineSnapshotEdits = rootNode
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

	const jestUseFakeTimersEdits = rootNode
		.findAll("jest.useFakeTimers()")
		.map((node) => node.replace("mock.timers.enable()"));

	const jestUseRealTimersEdits = rootNode
		.findAll("jest.useRealTimers()")
		.map((node) => node.replace("mock.timers.reset()"));

	// TODO: Check if we can do this the run all recursively to match behavior
	// TODO: Check if we can run only microtasks
	const jestRunAllTicksEdits = rootNode
		.findAll("jest.runAllTicks()")
		.map((node) => node.replace("mock.timers.runAll()"));

	const jestRunAllTimersEdits = rootNode
		.findAll("jest.runAllTimers()")
		.map((node) => node.replace("mock.timers.runAll()"));

	// FIXME: Potentially incorrect if used with await/promise chaining
	const jestRunAllTimersAsyncEdits = rootNode
		.findAll("jest.runAllTimersAsync()")
		.map((node) => node.replace("mock.timers.runAll()"));

	// TODO: Check if we can run only immediates
	const jestRunAllImmediatesEdits = rootNode
		.findAll("jest.runAllImmediates()")
		.map((node) => node.replace("mock.timers.runAll()"));

	const jestAdvanceTimersByTimeEdits = rootNode
		.findAll("jest.advanceTimersByTime($TIME)")
		.map((node) => {
			const time = node.getMatch("TIME")?.text();
			return node.replace(`mock.timers.tick(${time})`);
		});

	// FIXME: Potentially incorrect if used with await/promise chaining
	const jestAdvanceTimersByTimeAsyncEdits = rootNode
		.findAll("jest.advanceTimersByTimeAsync($TIME)")
		.map((node) => {
			const time = node.getMatch("TIME")?.text();
			return node.replace(`mock.timers.tick(${time})`);
		});

	const jestRunOnlyPendingTimersEdits = rootNode
		.findAll("jest.runOnlyPendingTimers()")
		.map((node) => node.replace("mock.timers.runAll()"));

	const jestRunOnlyPendingTimersAsyncEdits = rootNode
		.findAll("jest.runOnlyPendingTimersAsync()")
		.map((node) => node.replace("mock.timers.runAll()"));

	// TODO: Consider if advanceToNextTimer is translatable

	// TODO: Consider if advanceToNextTimerAsync is translatable

	const jestClearAllTimersEdits = rootNode
		.findAll("jest.clearAllTimers()")
		.map((node) => node.replace("mock.timers.reset()"));

	// TODO: Consider if getTimerCount is translatable"

	const jestNowEdits = rootNode.findAll("jest.now()").map((node) => node.replace("Date.now()"));

	const jestSetSystemTimeEdits = rootNode.findAll("jest.setSystemTime($TIME)").map((node) => {
		const time = node.getMatch("TIME")?.text();
		// FIXME: Hack to work with Date and number
		return node.replace(`mock.timers.setTime(Number(${time}))`);
	});

	// TODO: Consider if getRealSystemTime is translatable

	edits.push(
		...deleteJestImportEdits,
		...moduleMockWithFactoryEdits,
		...requireActualEdits,
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

	return rootNode.commitEdits(edits);
}
