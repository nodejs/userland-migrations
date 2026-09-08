import colors from 'ansi-colors';

const foo = colors.unstyle(colors.bold.blue('hello'));

/**
 * @param {string} text
 * @returns {string}
 */
const restyle = (text) => {
	const stripped = colors.unstyle(text);

	return colors.bold.blue(stripped);
}

console.log(foo);
