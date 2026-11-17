import { createHmac } from 'node:crypto';

const hmac = createHmac('sha256', 'secret');
if (condition) {
	hmac.digest('hex');
} else {
	hmac.digest();
}
