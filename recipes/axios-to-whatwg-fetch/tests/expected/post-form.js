const base = 'https://dummyjson.com/forms';

const created = await fetch(`${base}/submit`, {
	method: 'POST',
	body: new URLSearchParams({
	    title: 'Form Demo',
	    completed: false,
	})
})
	.then(async (res) => Object.assign(res, { data: await res.json() }))
	.catch(() => null);
console.log(created);
