// No ERR_INVALID_CALLBACK references - should not be modified
try {
  fs.readFile("file.txt", callback);
} catch (err) {
  if (err.code === "ENOENT") {
    console.error("File not found");
  }
}
