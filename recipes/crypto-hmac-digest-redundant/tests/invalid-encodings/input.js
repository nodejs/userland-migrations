import { createHmac } from 'node:crypto';

const hmac = createHmac('sha256', 'secret');
hmac.digest('hex');
hmac.digest('invalid-encoding');
