const timersNamespace = require("node:timers");
const { unenroll: cancelAlias } = require("node:timers");

import timersDefault from "node:timers";
import { unenroll as release } from "node:timers";
import * as timersESMNamespace from "node:timers";

async function fromNamespace(resource) {
	timersNamespace.unenroll(resource.target);
}

function fromCjsAlias(resource) {
	cancelAlias(resource.target);
}

function fromEsmDefault(resource) {
	timersDefault.unenroll(resource);
}

function fromEsmNamed(resource) {
	release(resource.item);
}

function fromEsmNamespace(resource) {
	timersESMNamespace.unenroll(resource.node);
}

async function fromDynamic(resource) {
	const { unenroll } = await import("node:timers");
	unenroll(resource.session);
}

async function fromDynamicAlias(resource) {
	const { unenroll: cancel } = await import("node:timers");
	cancel(resource.session);
}
