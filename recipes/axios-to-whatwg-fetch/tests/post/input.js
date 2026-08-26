import axios from 'axios';
const base = 'https://dummyjson.com/todos/add';

const todoCreated = await axios.post(base, {
	todo: 'Use DummyJSON in the project',
	completed: false,
	userId: 5,
});
console.log('\nPOST /todos ->', todoCreated);
