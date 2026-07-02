// Dynamic imports with SlowBuffer
const { SlowBuffer } = await import('buffer');
const { SlowBuffer: SB, Buffer } = await import('buffer');
const buffer = await import('buffer');

// Usage patterns with dynamic imports
const buf1 = new SlowBuffer(1024);
const buf2 = SlowBuffer(512);
const buf3 = new SB(256);
const buf4 = SB(128);

// Mixed with regular imports
import { constants } from 'buffer';
const { SlowBuffer: DynamicSB } = await import('buffer');
const buf5 = DynamicSB(64);

// Direct usage from buffer module (these patterns are handled by member access, not dynamic imports)
const buf6 = new buffer.SlowBuffer(32);
const buf7 = buffer.SlowBuffer(16);