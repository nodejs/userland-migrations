import { createHmac } from 'node:crypto';

const hmac = createHmac('sha256', 'secret');
const first = hmac.digest('hex');
const second = hmac.digest('hex');
consume(first, second);
