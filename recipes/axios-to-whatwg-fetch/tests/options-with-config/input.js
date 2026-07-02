import axios from 'axios';

const all = await axios.options('https://dummyjson.com/todos', {
	headers: { 'Content-Type': 'application/json' },
});
