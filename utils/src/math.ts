export function gcd(a: number, b: number): number {
	if (typeof a !== 'number' || typeof b !== 'number') {
		throw new TypeError('Both arguments must be numbers.');
	}

	let x = Math.abs(a);
	let y = Math.abs(b);
	while (y !== 0) {
		const temp = y;
		y = x % y;
		x = temp;
	}
	return x;
}
