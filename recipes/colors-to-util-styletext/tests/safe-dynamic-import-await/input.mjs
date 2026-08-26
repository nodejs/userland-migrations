const { red, green: success } = await import("colors/safe");

console.log(red("Error message"));
console.log(success("Success message"));
