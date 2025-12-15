import chalk from "chalk";
import { otherFunction } from "./utils";

function logError(message) {
	console.log(chalk.red.bold(`ERROR: ${message}`));
}

function logSuccess(message) {
	console.log(chalk.green(`SUCCESS: ${message}`));
}

logError("Something went wrong");
logSuccess("Operation completed");
