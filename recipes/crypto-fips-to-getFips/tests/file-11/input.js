const { fips } = await import("node:crypto");

fips = true;
console.log(fips);
