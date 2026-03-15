const timers = require("node:timers");

const resource = {
	_idleTimeout: 500,
	timeout: setTimeout(() => { }, 500),
	_onTimeout() {
		console.log("again");
	},
};

timers.active(resource);
