const { env, cwd } = require("node:process"); // mainModule as first
const { env, cwd } = require("node:process"); // mainModule as last
const { env, cwd } = require("node:process"); // mainModule at middle

if (require.main === module) {
	console.log(env, cwd);
} else {
	//code
}
