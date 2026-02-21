
export async function fetchTodos() {
    const response = await fetch('https://dummyjson.com/todos')
	.then(async (res) => Object.assign(res, { data: await res.json() }))
	.catch(() => null);
    return response.data;
}
