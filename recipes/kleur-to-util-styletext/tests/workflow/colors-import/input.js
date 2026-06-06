import { red, green, dim as muted, bgRed, white } from "kleur/colors";

console.log(red("Error"));
console.log(green("OK") + " " + muted(name));
console.log(bgRed(white("FAIL")));
