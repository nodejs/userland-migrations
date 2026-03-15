const timersNamespace = require("node:timers");
const { enroll: enrollAlias } = require("node:timers");

import timersDefault from "node:timers";
import { enroll as enrollRenamed } from "node:timers";
import * as timersESMNamespace from "node:timers";

async function fromNamespace(resource) {
	resource.target._idleTimeout = resource.delay;
	resource.target.timeout = setTimeout(() => {
		if (typeof resource.target._onTimeout === "function") {
			resource.target._onTimeout();
		}
	}, resource.delay);
}

function fromCjsAlias(resource) {
	resource.target._idleTimeout = resource.delay + 5;
	resource.target.timeout = setTimeout(() => {
		if (typeof resource.target._onTimeout === "function") {
			resource.target._onTimeout();
		}
	}, resource.delay + 5);
}

function fromEsmDefault(resource) {
	resource._idleTimeout = 100;
	resource.timeout = setTimeout(() => {
		if (typeof resource._onTimeout === "function") {
			resource._onTimeout();
		}
	}, 100);
}

function fromEsmNamed(resource) {
	resource._idleTimeout = getDelay();
	resource.timeout = setTimeout(() => {
		if (typeof resource._onTimeout === "function") {
			resource._onTimeout();
		}
	}, getDelay());
}

function fromEsmNamespace(resource) {
	resource.item._idleTimeout = resource.timeout;
	resource.item.timeout = setTimeout(() => {
		if (typeof resource.item._onTimeout === "function") {
			resource.item._onTimeout();
		}
	}, resource.timeout);
}

async function fromDynamic(resource) {
	const { enroll } = await import("node:timers");
	resource.node._idleTimeout = resource.delay;
	resource.node.timeout = setTimeout(() => {
		if (typeof resource.node._onTimeout === "function") {
			resource.node._onTimeout();
		}
	}, resource.delay);
}

async function fromDynamicAlias(resource) {
	const { enroll: load } = await import("node:timers");
	resource.node._idleTimeout = 50;
	resource.node.timeout = setTimeout(() => {
		if (typeof resource.node._onTimeout === "function") {
			resource.node._onTimeout();
		}
	}, 50);
}

function getDelay() {
	return 300;
}
