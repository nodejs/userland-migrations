const timers = require("node:timers");

const resource = {
	_onTimeout() {
		console.log("done");
	},
};

timers.enroll(resource, 1000);
