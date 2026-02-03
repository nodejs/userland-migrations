const timersNamespace = require("node:timers");
const { _unrefActive: unrefAlias } = require("node:timers");

import timersDefault from "node:timers";
import { _unrefActive as unref } from "node:timers";
import * as timersESMNamespace from "node:timers";

async function fromNamespace(resource) {
	timersNamespace._unrefActive(resource.target);
}

function fromCjsAlias(resource) {
	unrefAlias(resource.target);
}

function fromEsmDefault(resource) {
	timersDefault._unrefActive(resource);
}

function fromEsmNamed(resource) {
	unref(resource.item);
}

function fromEsmNamespace(resource) {
	timersESMNamespace._unrefActive(resource.node);
}

async function fromDynamic(resource) {
	const { _unrefActive } = await import("node:timers");
	_unrefActive(resource.session);
}

async function fromDynamicAlias(resource) {
	const { _unrefActive: unrefDynamic } = await import("node:timers");
	unrefDynamic(resource.session);
}
