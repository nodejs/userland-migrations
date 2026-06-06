import("kleur").then((kleur) => {
	console.log(kleur.red("Error"));
	console.log(kleur.bold().green("OK"));
});
