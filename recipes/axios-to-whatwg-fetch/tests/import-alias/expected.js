
async function loadTodo() {
    const response = await fetch('/todos/1')
	.then(async (res) => Object.assign(res, { data: await res.json() }))
	.catch(() => null);
    return response.data;
}

export { loadTodo };
