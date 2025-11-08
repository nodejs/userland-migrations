import axios from 'axios';

// Unsupported method: axios.request
const base = 'https://dummyjson.com/todos/1';

const customRequest = await axios.request({
	url: base,
	method: 'PATCH',
	data: {
		todo: 'Updated todo',
		completed: true,
	},
});
console.log('\nREQUEST /todos/1 ->', customRequest);
