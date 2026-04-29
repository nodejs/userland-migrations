// CommonJS style dynamic import
async function testCommonJS() {
    const zlib = await import("node:zlib");
    const gzip = zlib.createGzip();
    console.log(gzip.bytesWritten);
}

async function testCommonJSLet() {
    let zlib = await import("node:zlib");
    const gzip = zlib.createGzip();
    console.log(gzip.bytesWritten);
}

async function testCommonJSVar() {
    var zlib = await import("node:zlib");
    const gzip = zlib.createGzip();
    console.log(gzip.bytesWritten);
}

// ESM style dynamic import
const zlibESM = await import("node:zlib");
const gzipESM = zlibESM.createGzip();
console.log(gzipESM.bytesWritten);