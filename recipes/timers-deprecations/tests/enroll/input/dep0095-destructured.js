const { enroll } = require("node:timers");

const scope = {
    _onTimeout() {
        console.log("refresh");
    },
};

enroll(scope, 250);
