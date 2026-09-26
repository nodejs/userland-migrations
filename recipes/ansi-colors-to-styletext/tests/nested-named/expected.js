import { styleText, stripVTControlCharacters } from 'node:util';
stripVTControlCharacters(styleText('red', 'x'));
