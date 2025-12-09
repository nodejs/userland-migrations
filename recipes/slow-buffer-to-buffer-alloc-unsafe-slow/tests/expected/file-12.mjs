// Dynamic imports with SlowBuffer
const { Buffer } = await import('buffer');
const { Buffer: SB, Buffer } = await import('buffer');
const buffer = await import('buffer');

// Usage patterns with dynamic imports
const buf1 = Buffer.allocUnsafeSlow(1024);
const buf2 = Buffer.allocUnsafeSlow(512);
const buf3 = SB.allocUnsafeSlow(256);
const buf4 = SB.allocUnsafeSlow(128);

// Mixed with regular imports
import { constants } from 'buffer';
const { Buffer: DynamicSB } = await import('buffer');
const buf5 = DynamicSB.allocUnsafeSlow(64);

// Direct usage from buffer module (these patterns are handled by member access, not dynamic imports)
const buf6 = buffer.SlowBuffer.allocUnsafeSlow(32);
const buf7 = buffer.SlowBuffer.allocUnsafeSlow(16);