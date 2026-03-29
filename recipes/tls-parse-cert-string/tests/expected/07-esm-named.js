import { connect } from 'node:tls';

const out = /* DEP0076: use node:crypto X509Certificate for robust parsing */ Object.fromEntries(String('CN=example.com/O=Example').split('/').filter(Boolean).map((pair) => pair.split('=')));
connect(443, 'example.com');
