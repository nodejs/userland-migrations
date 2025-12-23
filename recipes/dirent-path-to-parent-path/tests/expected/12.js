const myFS = await import('node:fs');

function test(){
	const entries = myFS.readdir('./directory', { withFileTypes: true });
	entries.forEach(({parentPath, name}) => {
		const fullPath = `${parentPath}/${name}`;
		console.log(fullPath);
	});
}
