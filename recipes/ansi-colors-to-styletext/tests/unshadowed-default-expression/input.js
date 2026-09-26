import ac from 'ansi-colors';
function render(color = ac.red('default')) { return color; }
const { ac: other } = settings;
ac.blue('imported');
