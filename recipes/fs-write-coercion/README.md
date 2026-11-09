# DEP0162: Implicit coercion of objects to strings in `fs` write functions

This recipe adds explicit `String()` conversion for objects passed as the data parameter to `fs` write functions.

See [DEP0162](https://nodejs.org/api/deprecations.html#DEP0162).

## Example

```diff
  const fs = require("node:fs");

  const data = { toString: () => "file content" };
- fs.writeFileSync("file.txt", data);
+ fs.writeFileSync("file.txt", String(data));
```

## Supported APIs

- `fs.writeFile` / `fs.writeFileSync`
- `fs.appendFile` / `fs.appendFileSync`
- `fs.write`
- `fsPromises.writeFile` / `fsPromises.appendFile`

Also handles destructured imports:

```diff
  const { writeFileSync } = require("node:fs");

  const data = { toString: () => "content" };
- writeFileSync("file.txt", data);
+ writeFileSync("file.txt", String(data));
```
