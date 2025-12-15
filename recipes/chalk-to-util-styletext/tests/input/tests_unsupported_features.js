// Test file for unsupported chalk features
const chalk = require('chalk');

// 1. chalk.hex - should be left unchanged (unsupported)
console.log(chalk.hex('#DEADED').bold('Custom hex color'));
console.log(chalk.hex('#FF5733')('Another hex color'));

// 2. chalk.rgb - should be left unchanged (unsupported)
console.log(chalk.rgb(255, 136, 0).bold('RGB orange color'));
console.log(chalk.rgb(100, 200, 50)('RGB green color'));

// 3. chalk.ansi256 - should be left unchanged (unsupported)
console.log(chalk.ansi256(194)('ANSI 256 color'));
console.log(chalk.bgAnsi256(45).white('Background ANSI color'));

// 4. new Chalk() - should be left unchanged (unsupported)
const customChalk = new chalk.Chalk({ level: 2 });
console.log(customChalk.red('Custom chalk instance'));

// 5. chalk.level - property access should be ignored
if (chalk.level > 0) {
  console.log(chalk.green('Colors are supported'));
}

// 6. chalk.visible - should handle visibility logic
console.log(chalk.visible('This text may not be visible'));
console.log(chalk.red.visible('Red text that may not be visible'));

// Mixed cases that should still work
console.log(chalk.red('This should be transformed'));
console.log(chalk.bold.blue('This should also be transformed'));

// Edge case: method chaining with unsupported methods
console.log(chalk.red.hex('#FF0000')('Mixed supported and unsupported'));
