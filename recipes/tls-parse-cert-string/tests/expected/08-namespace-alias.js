import * as secureTls from 'node:tls';

const parsed = /* DEP0076: use node:crypto X509Certificate for robust parsing */ Object.fromEntries(String(subject).split('/').filter(Boolean).map((pair) => pair.split('=')));
