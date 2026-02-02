import * as c from "chalk";

function logError(message) {
	console.log(c.red.bold(`ERROR: ${message}`));
}

function logSuccess(message) {
	console.log(c.green(`SUCCESS: ${message}`));
}

logError("Something went wrong");
logSuccess("Operation completed");
