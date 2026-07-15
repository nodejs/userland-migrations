// CommonJS style dynamic import
async function testCommonJS() {
	const kleur = await import("kleur");
	console.log(kleur.bgBlue("This is a message"));
}

// ESM style dynamic import
const kleur = await import("kleur");
console.log(kleur.bgRed("This is a message"));
