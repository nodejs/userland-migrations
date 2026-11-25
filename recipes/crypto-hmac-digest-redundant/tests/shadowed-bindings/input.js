import { createHmac } from 'node:crypto';

const hmac = createHmac('sha256', 'outer');
{
	const hmac = createHmac('sha256', 'inner');
	hmac.digest('hex');
}
hmac.digest();
