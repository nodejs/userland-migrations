
function fetchAllTodos() {
    return fetch('https://dummyjson.com/todos')
	.then(async (res) => Object.assign(res, { data: await res.json() }))
	.catch(() => null);
}

module.exports = { fetchAllTodos };
