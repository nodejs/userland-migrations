import rimraf from "rimraf-v3";

rimraf("dist", (error) => {
	if (error) throw error;
});
