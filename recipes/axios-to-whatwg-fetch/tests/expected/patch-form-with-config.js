
const patched = await fetch('https://dummyjson.com/forms/2', {

"method": "PATCH",

"headers": {},

"body": "new URLSearchParams({ done: true })"
})
	.then(async (resp) => Object.assign(resp, { data: await resp.json() }))
	.catch(() => null);
console.log(patched.status);
