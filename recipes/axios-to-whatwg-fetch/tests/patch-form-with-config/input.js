import axios from 'axios';

const patched = await axios.patchForm(
	'https://dummyjson.com/forms/2',
	{ done: true },
	{
		headers: {
			Accept: 'application/json',
		},
	},
);
console.log(patched.status);
