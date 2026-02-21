import axios from 'axios';
const base = 'https://dummyjson.com/todos/1';

const updatedTodo = await axios.put(base, {
	todo: 'Use DummyJSON in the project',
	completed: false,
	userId: 5,
});
console.log('\nPUT /todos/1 ->', updatedTodo);
