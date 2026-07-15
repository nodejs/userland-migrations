const kleur = require("kleur");

const b = true;
const c = b ? kleur.bold : kleur.underline;

console.log(c("Conditional style"));
