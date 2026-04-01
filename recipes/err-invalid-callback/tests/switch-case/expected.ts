switch (error.code) {
  case "ERR_INVALID_ARG_TYPE":
    console.log("Invalid callback");
    break;
  case "ENOENT":
    console.log("File not found");
    break;
}
