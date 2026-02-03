const { enroll, active } = require("node:timers");

function setup(resource) {
	resource._idleTimeout = 42;
	resource.timeout = setTimeout(() => { }, 42);
}

setup({});
