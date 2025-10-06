// CommonJS style dynamic import
async function testCommonJS() {
    const zlib = await import("node:zlib");
    const gzip = zlib.createGzip();
    console.log(gzip.bytesRead);
}

async function testCommonJSLet() {
    let zlib = await import("node:zlib");
    const gzip = zlib.createGzip();
    console.log(gzip.bytesRead);
}

async function testCommonJSVar() {
    var zlib = await import("node:zlib");
    const gzip = zlib.createGzip();
    console.log(gzip.bytesRead);
}

// ESM style dynamic import
const zlibESM = await import("node:zlib");
const gzipESM = zlibESM.createGzip();
console.log(gzipESM.bytesRead);