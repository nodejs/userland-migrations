import data from './data.json' assert { type: 'json' };

const data2 = await import('./data2.json', {
	assert: { type: 'json' },
});

await import('./data3.json', {
	assert: { type: 'json' },
});

await import('pkg');

function getData4() {
	import('pkg-bis');

	return import('./data4.json', {
		assert: { type: 'json' },
	});
}
