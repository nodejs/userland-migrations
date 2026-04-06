const myFS = await import('node:fs');

function test(){
	const entries = myFS.readdir('./directory', { withFileTypes: true });
	entries.forEach(({path, name}) => {
		const fullPath = `${path}/${name}`;
		console.log(fullPath);
	});
}
