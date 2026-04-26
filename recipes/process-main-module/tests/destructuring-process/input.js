const { mainModule } = process;

if (mainModule === module) {
	console.log(mainModule.filename);
}
