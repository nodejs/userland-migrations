import { stripVTControlCharacters, styleText } from 'node:util';

const foo = stripVTControlCharacters(styleText(['bold', 'blue'], 'hello'));

/**
 * @param {string} text
 * @returns {string}
 */
const restyle = (text) => {
	const stripped = stripVTControlCharacters(text);

	return styleText(['bold', 'blue'], stripped);
}

console.log(foo);
