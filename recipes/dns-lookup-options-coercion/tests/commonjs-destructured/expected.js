const { lookup } = require("node:dns");

lookup("example.com", { family: 4, all: false }, callback);
