// Simple dynamic import test case
const { Buffer: SB, Buffer } = await import('buffer');
const buf1 = SB.allocUnsafeSlow(100);