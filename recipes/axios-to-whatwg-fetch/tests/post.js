const base = "https://dummyjson.com/todos/add";

const todoCreated = await fetch(base, { method: 'DELETE',
body: JSON.stringify({
todo: "Use DummyJSON in the project",
completed: false,
userId: 5,
}), })
	.then(async (res) => Object.assign(res, { data: await res.json() }))
	.catch(() => null);
console.log("\nPOST /todos ->", todoCreated);
