import chalk from "chalk";

console.error(chalk.chalkStderr.red("Error message"));

// Chained usage
console.error(chalk.chalkStderr.red.bold("Critical error"));

// Multiple chained styles
console.error(chalk.chalkStderr.red.bold.underline("Very important error"));
