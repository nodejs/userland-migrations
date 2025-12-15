// CommonJS style dynamic import
async function testCommonJS() {
	const { styleText } = await import("node:util");
	console.log(styleText("bgBlue", "This is a message"));
}

// ESM style dynamic import
const { styleText } = await import("node:util");
console.log(styleText("bgRed", "This is a message"));
