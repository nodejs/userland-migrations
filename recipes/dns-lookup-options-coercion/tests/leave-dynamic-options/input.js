const dns = require("node:dns");

dns.lookup("example.com", { family: familyOption, hints: dns.ADDRCONFIG, all: shouldReturnAll }, callback);
