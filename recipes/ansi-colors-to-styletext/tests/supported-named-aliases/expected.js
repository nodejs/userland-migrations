const { styleText, stripVTControlCharacters } = require('node:util');
stripVTControlCharacters(styleText('bgRedBright', styleText('blackBright', 'text')));
