import {
	cp as copy,
	rm as foo,
	mkdirSync as makeDir,
	readdirSync as readDir
} from "node:fs";

import * as fileSystem from "node:fs";

const sourcePath = "path/to/source";
const targetPath = "path/to/target";
const dirPath = "path/to/directory";

copy(sourcePath, targetPath, () => {
  console.log("File copied!");
});

foo(dirPath, { recursive: true }, () => {
  console.log("Directory removed!");
});

fileSystem.move(targetPath, "path/to/renamed", () => {
  console.log("File renamed!");
});

makeDir(dirPath);

const files = readDir(dirPath);
