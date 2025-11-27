const timers = require("node:timers");

const resource = {
	timeout: setTimeout(() => { }, 1000),
};

timers.unenroll(resource);
