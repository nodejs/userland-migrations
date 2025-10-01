// Simple dynamic import test case
const { SlowBuffer: SB, Buffer } = await import('buffer');
const buf1 = new SB(100);