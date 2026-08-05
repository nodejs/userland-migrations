
const base = 'https://dummyjson.com/todos/1';

const customPatch = await fetch(base, {
	method: "PATCH",
	body: JSON.stringify({
			todo: 'Updated todo',
			completed: true,
		})
})
.then(async (resp) => Object.assign(resp, { data: await resp.json() }))
.catch(() => null);
console.log('\nPATCH /todos/1 ->', customPatch);

const customGet = await fetch(base, { method: "GET" })
.then(async (resp) => Object.assign(resp, { data: await resp.json() }))
.catch(() => null);
console.log('\nGET /todos/1 ->', customGet);

const customPost = await fetch('https://dummyjson.com/todos/add', {
	method: "POST",
	body: JSON.stringify({
			todo: 'New todo',
			completed: false,
		})
})
.then(async (resp) => Object.assign(resp, { data: await resp.json() }))
.catch(() => null);
console.log('\nPOST /todos/add ->', customPost);
