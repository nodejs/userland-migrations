import axios from "axios";
const base = "https://dummyjson.com/todos";

const all = await axios.get(base);
console.log("\nGET /todos ->", all.status);
console.log(`Preview: ${all.data.todos.length} todos`);
