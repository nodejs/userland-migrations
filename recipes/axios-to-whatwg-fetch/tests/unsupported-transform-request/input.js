import axios from 'axios';

const response = await axios.post('https://api.example.com/data', { foo: 'bar' }, {
    transformRequest: [(data) => {
        return JSON.stringify(data);
    }],
});
