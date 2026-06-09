import kleur from "kleur";

console.log(kleur.red("Error"));
console.log(kleur.green("Success"));
console.log(kleur.bold("Important"));
console.log(kleur.bgRed("Alert"));
console.log(`${kleur.blue("[INFO]")} ${kleur.green(user)}`);
console.log("Status: " + kleur.bold().green("OK"));
