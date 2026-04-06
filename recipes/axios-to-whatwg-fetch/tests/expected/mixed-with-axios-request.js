import axios from 'axios';

const response = await axios.get('https://api.example.com/items', {
    headers: { 'Authorization': 'Bearer token' },
});

const created = await axios.request({
    url: 'https://api.example.com/create',
    method: 'POST',
    data: { item: 'test' },
    validateStatus: (status) => status < 500,
});

console.log(response, created);
