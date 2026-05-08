import axios from 'axios';
const base = 'https://dummyjson.com/todos/add';

const createdTodo = await axios.post(
	base,
	{
		todo: 'Use DummyJSON in the project',
		completed: false,
		userId: 5,
	},
	{
		headers: { 'Content-Type': 'application/json' },
	},
);
console.log('\nPOST /todos/add ->', createdTodo);
