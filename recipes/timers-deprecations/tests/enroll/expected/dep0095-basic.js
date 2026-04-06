const timers = require("node:timers");

const resource = {
	_onTimeout() {
		console.log("done");
	},
};

resource._idleTimeout = 1000;
resource.timeout = setTimeout(() => {
	if (typeof resource._onTimeout === "function") {
		resource._onTimeout();
	}
}, 1000);
