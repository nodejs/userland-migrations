import { createHmac as myHmac } from 'crypto';

const hmac = myHmac('sha256', 'secret');
const digest = hmac.digest('hex');
hmac.digest();
