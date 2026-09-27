import { styleText } from 'node:util';
function paint(ac) { return ac.red('local'); }
styleText('blue', 'imported');
