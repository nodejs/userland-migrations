const timersNamespace = require("node:timers");
const { active: activeAlias } = require("node:timers");

import timersDefault from "node:timers";
import { active as markActive } from "node:timers";
import * as timersESMNamespace from "node:timers";

async function fromNamespace(resource) {
	timersNamespace.active(resource.target);
}

function fromCjsAlias(resource) {
	activeAlias(resource.target);
}

function fromEsmDefault(resource) {
	timersDefault.active(resource);
}

function fromEsmNamed(resource) {
	markActive(resource.item);
}

function fromEsmNamespace(resource) {
	timersESMNamespace.active(resource.node);
}

async function fromDynamic(resource) {
	const { active } = await import("node:timers");
	active(resource.session);
}

async function fromDynamicAlias(resource) {
	const { active: activateDynamic } = await import("node:timers");
	activateDynamic(resource.session);
}
