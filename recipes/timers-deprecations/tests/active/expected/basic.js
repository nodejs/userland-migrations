const timers = require("node:timers");

const resource = {
	_idleTimeout: 500,
	timeout: setTimeout(() => { }, 500),
	_onTimeout() {
		console.log("again");
	},
};

if (resource.timeout != null) {
	clearTimeout(resource.timeout);
}

resource.timeout = setTimeout(() => {
	if (typeof resource._onTimeout === "function") {
		resource._onTimeout();
	}
}, resource._idleTimeout);
