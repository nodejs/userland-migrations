// Single-quoted string usage
try {
  fs.readFile("file.txt", "invalid-callback");
} catch (err) {
  if (err.code === 'ERR_INVALID_ARG_TYPE') {
    console.error("Invalid callback provided");
  }
}
