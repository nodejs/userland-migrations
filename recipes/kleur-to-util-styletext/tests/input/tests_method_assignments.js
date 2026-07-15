const kleur = require("kleur");

// Method assignments to variables
const red = kleur.red;
const green = kleur.green;
const yellow = kleur.yellow;

// Using assigned methods
console.log(red("This is red"));
console.log(green("This is green"));

// Method assignments with chaining
const bold = kleur.bold;
const underline = kleur.underline;
console.log(bold("Bold text"));

// Complex assignments
const redBold = kleur.red.bold;
console.log(redBold("Red and bold"));

// Assignment in different scopes
function setupColors() {
    const blue = kleur.blue;
    return blue;
}

const blueFunc = setupColors();
console.log(blueFunc("Blue text"));
