const { enroll } = require("node:timers");

const scope = {
	_onTimeout() {
		console.log("refresh");
	},
};

scope._idleTimeout = 250;
scope.timeout = setTimeout(() => {
	if (typeof scope._onTimeout === "function") {
		scope._onTimeout();
	}
}, 250);
