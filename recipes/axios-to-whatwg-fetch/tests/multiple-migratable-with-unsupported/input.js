import axios from 'axios';

// These are all migratable
const users = await axios.get('https://api.example.com/users');
const posts = await axios.get('https://api.example.com/posts');

// But this has unsupported timeout, so entire file is skipped
const special = await axios.post('https://api.example.com/special', { data: 'test' }, {
    timeout: 5000,
});

console.log(users, posts, special);
