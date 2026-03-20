const timers = require("node:timers");

const resource = {
	timeout: setTimeout(() => { }, 1000),
};

clearTimeout(resource.timeout);
delete resource.timeout;
