import { stripVTControlCharacters, styleText } from 'node:util';
stripVTControlCharacters("ac.red('x')" + /* ac.red('x') */ styleText('red', 'x'));
