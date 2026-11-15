// An ordinary module that happens to export `load` and `resolve`.
export async function load(id) {
	return { id };
}

export async function resolve(a, b) {
	return a - b;
}
