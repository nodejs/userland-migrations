const chalk = require("chalk");

// Method assignments to variables
const red = chalk.red;
const green = chalk.green;
const yellow = chalk.yellow;

// Using assigned methods
console.log(red("This is red"));
console.log(green("This is green"));

// Method assignments with chaining
const bold = chalk.bold;
const underline = chalk.underline;
console.log(bold("Bold text"));

// Complex assignments
const redBold = chalk.red.bold;
console.log(redBold("Red and bold"));

// Assignment in different scopes
function setupColors() {
    const blue = chalk.blue;
    return blue;
}

const blueFunc = setupColors();
console.log(blueFunc("Blue text"));
