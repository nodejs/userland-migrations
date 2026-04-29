try {
  fs.readFile("file.txt", "invalid-callback");
} catch (err) {
  const isCallbackError =
    err.code === "ERR_INVALID_CALLBACK" ||
    err.code === "ERR_INVALID_ARG_TYPE";
  if (isCallbackError) {
    // Handle invalid callback error
  }
}
