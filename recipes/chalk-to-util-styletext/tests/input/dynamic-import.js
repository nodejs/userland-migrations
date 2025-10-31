// CommonJS style dynamic import
async function testCommonJS() {
	const chalk = await import("chalk");
	console.log(chalk.bgBlue("This is a message"));
}

// ESM style dynamic import
const chalk = await import("chalk");
console.log(chalk.bgRed("This is a message"));
