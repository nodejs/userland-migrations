import tls from 'node:tls';
import { SecurePair } from 'node:tls';

// Case 1: Via namespace
const pair1 = new tls.SecurePair();
const t1 = pair1.cleartext;

// Case 2: Direct
const pair2 = new SecurePair();
const t2 = pair2.encrypted;