// Single-quoted string usage
try {
  fs.readFile("file.txt", "invalid-callback");
} catch (err) {
  if (err.code === 'ERR_INVALID_CALLBACK') {
    console.error("Invalid callback provided");
  }
}
