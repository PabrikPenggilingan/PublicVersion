/**
 * Server-side image compression middleware using Sharp.
 * Acts as a fallback — if the client already compressed the image below 200KB, this is a no-op.
 * Compresses images in req.file.buffer in-place before they reach the controller.
 * PDFs are left untouched.
 */

const TARGET_BYTES = 200 * 1024; // 200KB
const MAX_DIMENSION = 1920;

let sharp;
try {
    sharp = require('sharp');
} catch (e) {
    console.warn('[compressImage middleware] Sharp not available, skipping server-side compression.');
    sharp = null;
}

async function compressImageMiddleware(req, res, next) {
    // Only act if there's an uploaded file that is an image and exceeds the target
    if (!sharp || !req.file) return next();
    if (!req.file.mimetype.startsWith('image/')) return next();
    if (req.file.size <= TARGET_BYTES) return next();

    try {
        const image = sharp(req.file.buffer);
        const metadata = await image.metadata();

        const originalSize = req.file.size;
        let compressed;

        // Try progressively lower quality until we hit the target
        const qualities = [75, 60, 45, 30];
        let width = metadata.width || MAX_DIMENSION;
        let height = metadata.height || MAX_DIMENSION;

        // Start by capping dimensions
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
            if (width >= height) {
                height = Math.round((height / width) * MAX_DIMENSION);
                width = MAX_DIMENSION;
            } else {
                width = Math.round((width / height) * MAX_DIMENSION);
                height = MAX_DIMENSION;
            }
        }

        for (const quality of qualities) {
            compressed = await sharp(req.file.buffer)
                .resize(width, height, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality, mozjpeg: true })
                .toBuffer();

            if (compressed.length <= TARGET_BYTES) break;

            // If still too big, also halve the dimensions for the next attempt
            width = Math.round(width * 0.75);
            height = Math.round(height * 0.75);
        }

        req.file.buffer = compressed;
        req.file.size = compressed.length;
        req.file.mimetype = 'image/jpeg';
        req.file.originalname = req.file.originalname.replace(/\.[^.]+$/, '.jpg');

        console.log(
            `[compressImage] ${(originalSize / 1024).toFixed(1)}KB → ${(compressed.length / 1024).toFixed(1)}KB`
        );
    } catch (err) {
        // Non-fatal: log and continue with original file
        console.error('[compressImage middleware] Compression failed, using original:', err.message);
    }

    next();
}

module.exports = compressImageMiddleware;
