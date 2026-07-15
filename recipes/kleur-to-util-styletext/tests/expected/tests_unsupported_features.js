// Test file for unrecognized kleur method names.
// kleur's real API has no method without a util.styleText equivalent, but this
// guards against typos or a future kleur release adding something new.
const { styleText } = require("node:util");

// 1. An unrecognized method - should be left unchanged (unsupported)
console.log(kleur.someFutureMethod('Not a real kleur method'));

// 2. kleur.enabled - property access should be ignored (not a call)
if (kleur.enabled) {
  console.log(styleText("green", 'Colors are supported'));
}

// Mixed cases that should still work
console.log(styleText("red", 'This should be transformed'));
console.log(styleText(["bold", "blue"], 'This should also be transformed'));

// Edge case: method chaining with an unsupported method
console.log(kleur.red.someFutureMethod('Mixed supported and unsupported'));
