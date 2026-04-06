const axiosModule = await import('axios');

export async function fetchTodos() {
    const response = await axiosModule.default.get('https://dummyjson.com/todos');
    return response.data;
}
