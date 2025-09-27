import { format as fmt } from 'node:url';

const b = fmt({
    protocol: 'http',
    host: 'example.org:8080',
    pathname: 'path',
    search: 'q=1',
});
