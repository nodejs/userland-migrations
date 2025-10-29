const { unenroll } = require("node:timers");

const queue = {
	timeout: setTimeout(() => { }, 200),
};

unenroll(queue);
