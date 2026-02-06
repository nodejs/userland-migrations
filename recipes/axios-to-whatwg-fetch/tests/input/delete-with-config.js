import axios from 'axios';

const deletedTodo = await axios.delete('https://dummyjson.com/todos/1', {
	headers: { 'Content-Type': 'application/json' },
});
console.log('\nDELETE /todos1/1 ->', deletedTodo);
