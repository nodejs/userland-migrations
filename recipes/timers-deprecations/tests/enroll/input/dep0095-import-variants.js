const timersNamespace = require("node:timers");
const { enroll: enrollAlias } = require("node:timers");

import timersDefault from "node:timers";
import { enroll as enrollRenamed } from "node:timers";
import * as timersESMNamespace from "node:timers";

async function fromNamespace(resource) {
	timersNamespace.enroll(resource.target, resource.delay);
}

function fromCjsAlias(resource) {
	enrollAlias(resource.target, resource.delay + 5);
}

function fromEsmDefault(resource) {
	timersDefault.enroll(resource, 100);
}

function fromEsmNamed(resource) {
	enrollRenamed(resource, getDelay());
}

function fromEsmNamespace(resource) {
	timersESMNamespace.enroll(resource.item, resource.timeout);
}

async function fromDynamic(resource) {
	const { enroll } = await import("node:timers");
	enroll(resource.node, resource.delay);
}

async function fromDynamicAlias(resource) {
	const { enroll: load } = await import("node:timers");
	load(resource.node, 50);
}

function getDelay() {
	return 300;
}
