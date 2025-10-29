const { unenroll } = require("node:timers");

const queue = {
    timeout: setTimeout(() => { }, 200),
};

clearTimeout(queue.timeout);
delete queue.timeout;
