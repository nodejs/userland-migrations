// ESM import edge cases
import { SlowBuffer, Buffer } from 'buffer';
import { SlowBuffer as SB, Buffer as B } from 'buffer';
import { constants, SlowBuffer } from 'buffer';

// Various usage patterns with imports
const buf1 = new SlowBuffer(1024);
const buf2 = SlowBuffer(512);
const buf3 = new SB(256);
const buf4 = SB(128);