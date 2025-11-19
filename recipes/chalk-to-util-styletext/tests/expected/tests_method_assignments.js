const { styleText } = require("node:util");

// Method assignments to variables
const red = (text) => styleText("red", text);
const green = (text) => styleText("green", text);
const yellow = (text) => styleText("yellow", text);

// Using assigned methods
console.log(red("This is red"));
console.log(green("This is green"));

// Method assignments with chaining
const bold = (text) => styleText("bold", text);
const underline = (text) => styleText("underline", text);
console.log(bold("Bold text"));

// Complex assignments
const redBold = (text) => styleText(["red", "bold"], text);
console.log(redBold("Red and bold"));

// Assignment in different scopes
function setupColors() {
    const blue = (text) => styleText("blue", text);
    return blue;
}

const blueFunc = setupColors();
console.log(blueFunc("Blue text"));
