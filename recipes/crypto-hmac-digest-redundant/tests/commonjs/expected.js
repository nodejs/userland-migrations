const crypto = require('node:crypto');

const hmac = crypto.createHmac('sha256', 'secret');
hmac.digest('hex');
