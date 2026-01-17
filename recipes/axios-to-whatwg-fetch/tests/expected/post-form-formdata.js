
const formData = new FormData();
formData.append('name', 'Node.js');

await fetch('https://dummyjson.com/forms', {

"method": "POST",

"body": "(() => {
\tconst value = formData;
\tif (value instanceof FormData || value instanceof URLSearchParams) return value;
\treturn new URLSearchParams(value);
})()"
})
	.then(async (resp) => Object.assign(resp, { data: await resp.json() }))
	.catch(() => null);
