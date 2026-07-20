const base = "https://dummyjson.com/todos";

const all = await fetch(base)
	.then(async (res) => Object.assign(res, { data: await res.json() }))
	.catch(() => null);
console.log("\nGET /todos ->", all.status);
console.log(`Preview: ${all.data.todos.length} todos`);
