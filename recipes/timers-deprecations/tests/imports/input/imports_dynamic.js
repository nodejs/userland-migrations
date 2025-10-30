async function cleanupEnroll(resource) {
    const { enroll } = await import("node:timers");
    resource._idleTimeout = resource.delay;
    resource.timeout = setTimeout(() => {
        if (typeof resource._onTimeout === "function") {
            resource._onTimeout();
        }
    }, resource.delay);
}

async function cleanupAlias(resource) {
    const { active: activate } = await import("node:timers");
    if (resource.timeout != null) {
        clearTimeout(resource.timeout);
    }

    resource.timeout = setTimeout(() => {
        if (typeof resource._onTimeout === "function") {
            resource._onTimeout();
        }
    }, resource._idleTimeout);
}

async function cleanupDefault(resource) {
    const timersModule = await import("node:timers");
    resource.timeout = setTimeout(() => {
        if (typeof resource._onTimeout === "function") {
            resource._onTimeout();
        }
    }, resource._idleTimeout);
}

async function preserveNamespace(resource) {
    const timersModule = await import("node:timers");
    resource.timeout = setTimeout(() => {
        if (typeof resource._onTimeout === "function") {
            resource._onTimeout();
        }
    }, resource._idleTimeout);
    return timersModule;
}
