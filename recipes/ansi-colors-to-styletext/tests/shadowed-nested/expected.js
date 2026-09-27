import { styleText } from 'node:util';
styleText('red', ((ac) => ac.blue('local'))(custom));
function f(ac) { return ac.noop('local'); }
