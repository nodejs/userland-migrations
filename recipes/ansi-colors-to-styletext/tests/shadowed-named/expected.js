import { styleText } from 'node:util';
const render = ({ paint }) => paint('local');
styleText('red', 'imported');
