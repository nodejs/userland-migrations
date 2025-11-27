const { active } = require("node:timers");

const handle = {
    _idleTimeout: 750,
    timeout: setTimeout(() => { }, 750),
    _onTimeout() {
        console.log("tick");
    },
};

if (handle.timeout != null) {
    clearTimeout(handle.timeout);
}

handle.timeout = setTimeout(() => {
    if (typeof handle._onTimeout === "function") {
        handle._onTimeout();
    }
}, handle._idleTimeout);
