import { createHmac } from 'node:crypto';

const hmac = createHmac('sha256', 'secret');
hmac.update('message');
const digest = hmac.digest('hex');
console.log(digest);
