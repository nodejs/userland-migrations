import axios from 'axios';
const base = 'https://dummyjson.com/todos/1';

const deletedTodo = await axios.delete(base);
console.log('\nDELETE /todos ->', deletedTodo);
