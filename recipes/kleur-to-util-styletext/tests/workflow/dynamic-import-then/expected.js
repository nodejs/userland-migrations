import("node:util").then(({ styleText }) => {
	console.log(styleText("red", "Error"));
	console.log(styleText(["bold", "green"], "OK"));
});
