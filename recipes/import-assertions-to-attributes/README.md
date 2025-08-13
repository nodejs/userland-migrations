# Import Assertions to Attributes

This recipe converts import assertions (`assert` syntax) to the standardized import attributes (`with` syntax). It modifies code like:

```ts
// Before
import data from './data.json' assert { type: 'json' };

// After
import data from './data.json' with { type: 'json' };
```

## Usage

Run this codemod with:

```sh
npx codemod nodejs/import-assertions-to-attributes
```

## When is it useful?

The import assertions syntax is being deprecated in favor of the standardized import attributes syntax. This codemod helps transition existing codebases to the new syntax, ensuring compatibility with future versions of Node.js.

Node.js drop support of import assertions in favor of import attributes in version [`22.0.0`](https://nodejs.org/fr/blog/release/v22.0.0#other-notable-changes)
But the support for import attributes was added in Node.js version [`18.20.0`](https://nodejs.org/fr/blog/release/v18.20.0#added-support-for-import-attributes)
