const { getFips, setFips } = await import("node:crypto");

setFips(true);
console.log(getFips());
