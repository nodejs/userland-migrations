const { styleText } = require('node:util');
ac.enabled = false;
ac.visible = false;
ac.unstyle('some text');
ac.alias('error', ac.bold.red);
ac.theme({ error: ac.bold.red });

console.log(styleText('red', 'text'));