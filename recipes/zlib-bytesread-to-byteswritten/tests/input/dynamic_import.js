// CommonJS style dynamic import
async function testCommonJS() {
    const zlib = await import("node:zlib");
    const gzip = zlib.createGzip();
    console.log(gzip.bytesRead);
}

// ESM style dynamic import
const zlib = await import("node:zlib");
const gzip = zlib.createGzip();
console.log(gzip.bytesRead);