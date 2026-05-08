async function main() {
	const data = await import('./data.json', { with: { type: 'json' } });
	const pkg = await import('pkg');

	return data;
}
