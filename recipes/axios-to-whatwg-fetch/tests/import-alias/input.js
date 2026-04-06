import ax from 'axios';

async function loadTodo() {
    const response = await ax.get('/todos/1');
    return response.data;
}

export { loadTodo };
