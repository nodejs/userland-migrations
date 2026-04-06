const axios = require('axios');

function fetchAllTodos() {
    return axios.get('https://dummyjson.com/todos');
}

module.exports = { fetchAllTodos };
