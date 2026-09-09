import { rimraf, rimrafSync } from "rimraf-v5";

await rimraf("dist");
rimrafSync("build");
