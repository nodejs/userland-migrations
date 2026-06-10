import tls from 'node:tls';

const parsed = tls.parseCertString('CN=example.com/O=Example');
