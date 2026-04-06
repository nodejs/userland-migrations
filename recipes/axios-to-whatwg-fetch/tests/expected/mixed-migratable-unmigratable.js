import axios from 'axios';

// This should be migratable
const todos = await axios.get('https://api.example.com/todos');

// But this one has unsupported transformRequest, so entire file should be skipped
const data = await axios.post('https://api.example.com/data', { foo: 'bar' }, {
    transformRequest: [(data) => JSON.stringify(data)],
});

console.log(todos, data);
