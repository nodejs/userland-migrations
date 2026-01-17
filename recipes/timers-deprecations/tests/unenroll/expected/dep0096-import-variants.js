const timersNamespace = require("node:timers");
const { unenroll: cancelAlias } = require("node:timers");

import timersDefault from "node:timers";
import { unenroll as release } from "node:timers";
import * as timersESMNamespace from "node:timers";

async function fromNamespace(resource) {
	clearTimeout(resource.target.timeout);
	delete resource.target.timeout;
}

function fromCjsAlias(resource) {
	clearTimeout(resource.target.timeout);
	delete resource.target.timeout;
}

function fromEsmDefault(resource) {
	clearTimeout(resource.timeout);
	delete resource.timeout;
}

function fromEsmNamed(resource) {
	clearTimeout(resource.item.timeout);
	delete resource.item.timeout;
}

function fromEsmNamespace(resource) {
	clearTimeout(resource.node.timeout);
	delete resource.node.timeout;
}

async function fromDynamic(resource) {
	const { unenroll } = await import("node:timers");
	clearTimeout(resource.session.timeout);
	delete resource.session.timeout;
}

async function fromDynamicAlias(resource) {
	const { unenroll: cancel } = await import("node:timers");
	clearTimeout(resource.session.timeout);
	delete resource.session.timeout;
}
