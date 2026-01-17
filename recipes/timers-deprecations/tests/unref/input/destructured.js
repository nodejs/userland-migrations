const { _unrefActive } = require("node:timers");

const task = {
	_idleTimeout: 90,
	timeout: setTimeout(() => { }, 90),
	_onTimeout() {
		console.log("idle");
	},
};

_unrefActive(task);
