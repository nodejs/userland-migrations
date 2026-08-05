import axios from 'axios';

const all = await axios.head('https://dummyjson.com/todos', {
	headers: { 'Content-Type': 'application/json' },
});
