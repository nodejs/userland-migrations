import axios from 'axios';

// Unsupported method: axios.patch
const base = 'https://dummyjson.com/todos/1';

const patchedTodo = await axios.patch(base, {
	todo: 'Updated todo',
	completed: true,
});
console.log('\nPATCH /todos/1 ->', patchedTodo);
