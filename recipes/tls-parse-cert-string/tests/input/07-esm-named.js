import { parseCertString, connect } from 'node:tls';

const out = parseCertString('CN=example.com/O=Example');
connect(443, 'example.com');
