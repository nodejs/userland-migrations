import kleur from "kleur";
import { otherFunction } from "./utils";

function logError(message) {
	console.log(kleur.red.bold(`ERROR: ${message}`));
}

function logSuccess(message) {
	console.log(kleur.green(`SUCCESS: ${message}`));
}

logError("Something went wrong");
logSuccess("Operation completed");
