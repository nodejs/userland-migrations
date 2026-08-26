import kleur from "kleur";

console.log(kleur.bold().red("Failure"));
console.log(kleur.bold().italic().red("Failure"));
console.log(kleur.bold().italic().underline().red("Failure"));

const errorStyle = (msg) => kleur.bold().red(msg);
const badge = kleur.bgRed().white(" ERROR ");
