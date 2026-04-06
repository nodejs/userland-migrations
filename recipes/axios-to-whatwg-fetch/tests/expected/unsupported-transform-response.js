import axios from 'axios';

const response = await axios.get('https://api.example.com/data', {
    transformResponse: [(data) => {
        return { transformed: data };
    }],
});
