import * as crypto from 'node:crypto';

const credentials = crypto.createCredentials({
  key: fs.readFileSync('server-key.pem'),
  cert: fs.readFileSync('server-cert.pem')
});