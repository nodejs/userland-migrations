import('ansi-colors').then((ac) => {
	console.log(ac.red('Error'));
	console.log(ac.bold.green('Success'));
});