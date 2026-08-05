import axios from 'axios';
const base = 'https://dummyjson.com/forms';

const created = await axios.postForm(`${base}/submit`, {
    title: 'Form Demo',
    completed: false,
});
console.log(created);
