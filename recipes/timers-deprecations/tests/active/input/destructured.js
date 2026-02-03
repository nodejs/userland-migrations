const { active } = require("node:timers");

const handle = {
	_idleTimeout: 750,
	timeout: setTimeout(() => { }, 750),
	_onTimeout() {
		console.log("tick");
	},
};

active(handle);
