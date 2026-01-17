
const all = await fetch("https://dummyjson.com/todos", {"headers":{}})
	.then(async (res) => Object.assign(res, { data: await res.json() }))
	.catch(() => null);
console.log("\nGET /todos ->", all.status);
console.log(`Preview: ${all.data.todos.length} todos`);
