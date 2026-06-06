import rimraf from "rimraf-v4";

await rimraf("dist", { glob: false });
