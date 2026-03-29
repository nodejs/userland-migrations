import tls from 'node:tls';

const parsed = /* DEP0076: use node:crypto X509Certificate for robust parsing */ Object.fromEntries(String('CN=example.com/O=Example').split('/').filter(Boolean).map((pair) => pair.split('=')));
