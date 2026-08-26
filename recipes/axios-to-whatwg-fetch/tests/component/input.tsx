import axios from 'axios';
import { useEffect, useState } from 'react';

type Todo = { id: number; title: string };

export function TodoList() {
	const [todos, setTodos] = useState<Todo[]>([]);

	useEffect(() => {
		let active = true;

		axios
			.get('/api/todos')
			.then((response) => {
				if (active) {
					setTodos(response.data.todos);
				}
			})
			.catch(() => {});

		return () => {
			active = false;
		};
	}, []);

	return <div>{todos.length}</div>;
}
