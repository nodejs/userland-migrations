import { styleText } from "node:util";
import { otherFunction } from "./utils";

function logError(message) {
	console.log(styleText(["red", "bold"], `ERROR: ${message}`));
}

function logSuccess(message) {
	console.log(styleText("green", `SUCCESS: ${message}`));
}

logError("Something went wrong");
logSuccess("Operation completed");
