const base = 'https://dummyjson.com/forms';

const created = await fetch(`${base}/submit`, {

"method": "POST",

"body": "new URLSearchParams({
    title: 'Form Demo',
    completed: false,
})"
})
	.then(async (resp) => Object.assign(resp, { data: await resp.json() }))
	.catch(() => null);
console.log(created);
