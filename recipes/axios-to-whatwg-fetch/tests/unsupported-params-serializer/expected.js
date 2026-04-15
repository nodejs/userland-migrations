import axios from 'axios';

const response = await axios.get('https://api.example.com/data', {
    params: { foo: 'bar' },
    paramsSerializer: (params) => {
        return Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&');
    },
});
