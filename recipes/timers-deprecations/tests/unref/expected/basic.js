const timers = require("node:timers");

const resource = {
	_idleTimeout: 60,
	timeout: setTimeout(() => { }, 60),
	_onTimeout() {
		console.log("cleanup");
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
resource.timeout.unref?.();
