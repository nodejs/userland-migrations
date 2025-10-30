const timersNamespace = require("node:timers");
const { _unrefActive: unrefAlias } = require("node:timers");

import timersDefault from "node:timers";
import { _unrefActive as unref } from "node:timers";
import * as timersESMNamespace from "node:timers";

async function fromNamespace(resource) {
    if (resource.target.timeout != null) {
        clearTimeout(resource.target.timeout);
    }

    resource.target.timeout = setTimeout(() => {
        if (typeof resource.target._onTimeout === "function") {
            resource.target._onTimeout();
        }
    }, resource.target._idleTimeout);
    resource.target.timeout.unref?.();
}

function fromCjsAlias(resource) {
    if (resource.target.timeout != null) {
        clearTimeout(resource.target.timeout);
    }

    resource.target.timeout = setTimeout(() => {
        if (typeof resource.target._onTimeout === "function") {
            resource.target._onTimeout();
        }
    }, resource.target._idleTimeout);
    resource.target.timeout.unref?.();
}

function fromEsmDefault(resource) {
    if (resource.timeout != null) {
        clearTimeout(resource.timeout);
    }

    resource.timeout = setTimeout(() => {
        if (typeof resource._onTimeout === "function") {
            resource._onTimeout();
        }
    }, resource._idleTimeout);
    resource.timeout.unref?.();
}

function fromEsmNamed(resource) {
    if (resource.item.timeout != null) {
        clearTimeout(resource.item.timeout);
    }

    resource.item.timeout = setTimeout(() => {
        if (typeof resource.item._onTimeout === "function") {
            resource.item._onTimeout();
        }
    }, resource.item._idleTimeout);
    resource.item.timeout.unref?.();
}

function fromEsmNamespace(resource) {
    if (resource.node.timeout != null) {
        clearTimeout(resource.node.timeout);
    }

    resource.node.timeout = setTimeout(() => {
        if (typeof resource.node._onTimeout === "function") {
            resource.node._onTimeout();
        }
    }, resource.node._idleTimeout);
    resource.node.timeout.unref?.();
}

async function fromDynamic(resource) {
    const { _unrefActive } = await import("node:timers");
    if (resource.session.timeout != null) {
        clearTimeout(resource.session.timeout);
    }

    resource.session.timeout = setTimeout(() => {
        if (typeof resource.session._onTimeout === "function") {
            resource.session._onTimeout();
        }
    }, resource.session._idleTimeout);
    resource.session.timeout.unref?.();
}

async function fromDynamicAlias(resource) {
    const { _unrefActive: unrefDynamic } = await import("node:timers");
    if (resource.session.timeout != null) {
        clearTimeout(resource.session.timeout);
    }

    resource.session.timeout = setTimeout(() => {
        if (typeof resource.session._onTimeout === "function") {
            resource.session._onTimeout();
        }
    }, resource.session._idleTimeout);
    resource.session.timeout.unref?.();
}
