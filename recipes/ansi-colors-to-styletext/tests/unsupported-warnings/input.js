const ac = require('ansi-colors');
ac.enabled = false;
ac.visible = false;
ac.unstyle('some text');
ac.alias('error', ac.bold.red);
ac.theme({ error: ac.bold.red });

console.log(ac.red('text'));