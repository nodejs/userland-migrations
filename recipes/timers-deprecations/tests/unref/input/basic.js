const timers = require("node:timers");

const resource = {
	_idleTimeout: 60,
	timeout: setTimeout(() => { }, 60),
	_onTimeout() {
		console.log("cleanup");
	},
};

timers._unrefActive(resource);
