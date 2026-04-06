import axios from 'axios';

const response = await axios.request({
    url: 'https://api.example.com/data',
    method: 'POST',
    data: { foo: 'bar' },
    transformRequest: [(data) => data],
    transformResponse: [(data) => data],
});
