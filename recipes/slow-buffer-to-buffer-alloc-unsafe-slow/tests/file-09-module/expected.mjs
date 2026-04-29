// ESM import edge cases
import { Buffer } from 'buffer';
import { Buffer as SB, Buffer as B } from 'buffer';
import { constants, Buffer } from 'buffer';

// Various usage patterns with imports
const buf1 = Buffer.allocUnsafeSlow(1024);
const buf2 = Buffer.allocUnsafeSlow(512);
const buf3 = SB.allocUnsafeSlow(256);
const buf4 = SB.allocUnsafeSlow(128);