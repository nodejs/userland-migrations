import tls from 'node:tls';

// Using tls.SecurePair constructor
const pair = new tls.SecurePair();
const cleartext = pair.cleartext;
const encrypted = pair.encrypted;

// Direct import
import { SecurePair } from 'node:tls';
const pair2 = new SecurePair();