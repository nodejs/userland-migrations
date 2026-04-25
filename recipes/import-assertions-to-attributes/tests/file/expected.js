import data from './data.json' with { type: 'json' };

const data2 = await import('./data2.json', {
	with: { type: 'json' },
});

await import('./data3.json', {
	with: { type: 'json' },
});

await import('pkg');

function getData4() {
	import('pkg-bis');

	return import('./data4.json', {
		with: { type: 'json' },
	});
}
