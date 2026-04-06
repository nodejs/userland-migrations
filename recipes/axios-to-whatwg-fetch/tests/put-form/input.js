import axios from 'axios';

const payload = { status: 'open' };

const updated = await axios.putForm('https://dummyjson.com/forms/1', payload);
console.log(updated.status);
