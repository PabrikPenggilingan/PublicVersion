/**
 * Self-test: Verify iterative Sharp compression logic achieves ≤200KB
 */
const sharp = require('sharp');
const crypto = require('crypto');

const TARGET_BYTES = 200 * 1024;
const MAX_DIMENSION = 1920;

async function compressWithSharp(buffer) {
    if (buffer.length <= TARGET_BYTES) {
        return { buffer, skipped: true };
    }

    const metadata = await sharp(buffer).metadata();
    const qualities = [75, 60, 45, 30];
    let width = metadata.width || MAX_DIMENSION;
    let height = metadata.height || MAX_DIMENSION;

    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width >= height) { height = Math.round((height / width) * MAX_DIMENSION); width = MAX_DIMENSION; }
        else { width = Math.round((width / height) * MAX_DIMENSION); height = MAX_DIMENSION; }
    }

    let compressed;
    for (const quality of qualities) {
        compressed = await sharp(buffer)
            .resize(width, height, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality, mozjpeg: true })
            .toBuffer();
        if (compressed.length <= TARGET_BYTES) break;
        width = Math.round(width * 0.75);
        height = Math.round(height * 0.75);
    }

    return { buffer: compressed, skipped: false };
}

async function main() {
    console.log('=== Image Compression Self-Test (Iterative) ===\n');
    let allPassed = true;

    // Test 1: Large random-noise 1200x900 JPEG
    console.log('Test 1: 1200x900 random noise JPEG (worst-case scenario)');
    const raw = crypto.randomBytes(1200 * 900 * 3);
    const large = await sharp(raw, { raw: { width: 1200, height: 900, channels: 3 } })
        .jpeg({ quality: 95 }).toBuffer();
    console.log(`  Input:  ${(large.length / 1024).toFixed(1)} KB`);
    const r1 = await compressWithSharp(large);
    const p1 = r1.buffer.length <= TARGET_BYTES;
    console.log(`  Output: ${(r1.buffer.length / 1024).toFixed(1)} KB`);
    console.log(`  ${p1 ? '✅ PASS' : '❌ FAIL'} (target ≤200KB)\n`);
    if (!p1) allPassed = false;

    // Test 2: Medium image (500x500) already ≤200KB → should be skipped
    console.log('Test 2: Small image already ≤200KB → should skip compression');
    const raw2 = crypto.randomBytes(100 * 100 * 3);
    const small = await sharp(raw2, { raw: { width: 100, height: 100, channels: 3 } })
        .jpeg({ quality: 60 }).toBuffer();
    console.log(`  Input:  ${(small.length / 1024).toFixed(1)} KB`);
    const r2 = await compressWithSharp(small);
    const p2 = r2.skipped === true;
    console.log(`  Skipped: ${r2.skipped}`);
    console.log(`  ${p2 ? '✅ PASS' : '❌ FAIL'}\n`);
    if (!p2) allPassed = false;

    // Test 3: Ultra-high-res 4000x3000 image
    console.log('Test 3: 4000x3000 high-res image (dimension reduction required)');
    const raw3 = crypto.randomBytes(4000 * 3000 * 3);
    const huge = await sharp(raw3, { raw: { width: 4000, height: 3000, channels: 3 } })
        .jpeg({ quality: 95 }).toBuffer();
    console.log(`  Input:  ${(huge.length / 1024).toFixed(1)} KB`);
    const r3 = await compressWithSharp(huge);
    const p3 = r3.buffer.length <= TARGET_BYTES;
    console.log(`  Output: ${(r3.buffer.length / 1024).toFixed(1)} KB`);
    console.log(`  ${p3 ? '✅ PASS' : '❌ FAIL'} (target ≤200KB)\n`);
    if (!p3) allPassed = false;

    console.log('=== FINAL RESULT ===');
    console.log(allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED');
}

main().catch(err => { console.error(err); process.exit(1); });
