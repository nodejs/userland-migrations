import axios from "axios";

const all = await axios.get("https://dummyjson.com/todos", {
	headers: { "Content-Type": "application/json" },
});
console.log("\nGET /todos ->", all.status);
console.log(`Preview: ${all.data.todos.length} todos`);
