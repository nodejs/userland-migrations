async function main() {
	const data = await import('./data.json', { assert: { type: 'json' } });
	const pkg = await import('pkg');

	return data;
}
