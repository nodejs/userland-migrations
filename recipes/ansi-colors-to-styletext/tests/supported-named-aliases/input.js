const { gray: muted, bgRedBright: highlight, unstyle: strip } = require('ansi-colors');
strip(highlight(muted('text')));
