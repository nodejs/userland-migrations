const fs = require("node:fs");

// These are all valid and don't need changes
fs.writeFileSync("file1.txt", "string");
fs.writeFileSync("file2.txt", Buffer.from("buffer"));
fs.writeFileSync("file3.txt", new Uint8Array([1, 2, 3]));
fs.writeFileSync("file4.txt", String(someObj));
fs.writeFileSync("file5.txt", someObj.toString());
