const { mainModule, env, cwd } = require("node:process"); // mainModule as first
const { env, cwd, mainModule } = require("node:process"); // mainModule as last
const { env, mainModule, cwd } = require("node:process"); // mainModule at middle

if (mainModule === module) {
	console.log(env, cwd);
} else {
	//code
}
