const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer setup for bukti nota uploads (shared by sales & batch debt payments)
const notaStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = 'uploads/bukti-nota';
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'nota-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const notaUpload = multer({
    storage: notaStorage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files are allowed'), false);
    },
    limits: { fileSize: 10 * 1024 * 1024 }
});

module.exports = { notaUpload };
