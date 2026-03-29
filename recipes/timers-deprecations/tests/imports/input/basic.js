import timers from "node:timers";

const resource = {
	_idleTimeout: 100,
	timeout: setTimeout(() => { }, 100),
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
