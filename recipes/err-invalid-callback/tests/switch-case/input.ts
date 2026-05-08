switch (error.code) {
  case "ERR_INVALID_CALLBACK":
    console.log("Invalid callback");
    break;
  case "ENOENT":
    console.log("File not found");
    break;
}
