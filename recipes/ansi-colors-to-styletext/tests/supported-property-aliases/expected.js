import { stripVTControlCharacters, styleText } from 'node:util';
stripVTControlCharacters(styleText(['bold', 'blackBright'], 'text'));
styleText('bgRedBright', 'text');
