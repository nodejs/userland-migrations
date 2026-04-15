import axios from 'axios';

const formData = new FormData();
formData.append('name', 'Node.js');

await axios.postForm('https://dummyjson.com/forms', formData);
