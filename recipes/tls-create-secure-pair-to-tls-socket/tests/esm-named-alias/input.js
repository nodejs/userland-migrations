import { createSecurePair as csp } from 'node:tls';

// Using an alias
const pair = csp(credentials);
