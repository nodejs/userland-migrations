const dns = require("node:dns");

dns.lookup("example.com", { family: "4", hints: "0", all: 1, verbatim: 0 }, callback);
