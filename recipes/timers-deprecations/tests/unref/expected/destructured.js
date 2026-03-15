const { _unrefActive } = require("node:timers");

const task = {
	_idleTimeout: 90,
	timeout: setTimeout(() => { }, 90),
	_onTimeout() {
		console.log("idle");
	},
};

if (task.timeout != null) {
	clearTimeout(task.timeout);
}

task.timeout = setTimeout(() => {
	if (typeof task._onTimeout === "function") {
		task._onTimeout();
	}
}, task._idleTimeout);
task.timeout.unref?.();
