const { red, green: success, bgRed, white } = require("kleur/colors");

console.log(red("Error"));
console.log(success("OK"));
console.log(bgRed(white("FAIL")));
