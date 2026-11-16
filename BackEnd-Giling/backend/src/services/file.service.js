const { createClient } = require('@supabase/supabase-js');
const { query } = require('../config/database');
const config = require('../config/env');
const { v4: uuidv4 } = require('uuid');

class FileService {
    constructor() {
        // Initialize Supabase client
        if (config.supabase.url && config.supabase.key) {
            this.supabase = createClient(config.supabase.url, config.supabase.key);
            this.bucketName = config.supabase.bucketName;
            this.isConfigured = true;
        } else {
            console.warn('Supabase is not configured. File upload will not work.');
            this.isConfigured = false;
        }
    }

    // Generate unique file key
    generateKey(fileType, originalName) {
        const ext = originalName.split('.').pop();
        const timestamp = Date.now();
        const uuid = uuidv4().split('-')[0];
        return `${fileType}/${timestamp}-${uuid}.${ext}`;
    }

    // Upload file to Supabase Storage
    async uploadFile(buffer, originalName, mimeType, fileType) {
        const fileKey = this.generateKey(fileType, originalName);

        if (!this.isConfigured) {
            console.warn('Supabase storage is not configured. Mocking upload for local development.');
            return fileKey;
        }

        const { data, error } = await this.supabase.storage
            .from(this.bucketName)
            .upload(fileKey, buffer, {
                contentType: mimeType,
                upsert: false
            });

        if (error) {
            throw error;
        }

        return fileKey;
    }

    // Get signed URL for file access
    async getSignedUrl(fileKey, expiresIn = 3600) {
        if (!this.isConfigured) {
            throw new Error('Supabase storage is not configured');
        }

        const { data, error } = await this.supabase.storage
            .from(this.bucketName)
            .createSignedUrl(fileKey, expiresIn);

        if (error) {
            throw error;
        }

        return data.signedUrl;
    }

    // Delete file from Supabase Storage
    async deleteFromStorage(fileKey) {
        if (!this.isConfigured) {
            console.warn('Supabase storage is not configured. Mocking deletion for local development.');
            return;
        }

        const { error } = await this.supabase.storage
            .from(this.bucketName)
            .remove([fileKey]);

        if (error) {
            throw error;
        }
    }

    // Save file metadata to database
    async saveFileMetadata(data) {
        const { purchaseId, processId, saleId, saleType, fileType, r2Key, originalName, mimeType, sizeBytes, createdBy } = data;

        // Verify client-supplied foreign keys exist before inserting
        if (purchaseId) {
            const check = await query('SELECT id FROM trx.purchases WHERE id = $1', [purchaseId]);
            if (check.rows.length === 0) throw new Error('Purchase tidak ditemukan');
        }
        if (processId) {
            const check = await query('SELECT id FROM trx.processes WHERE id = $1', [processId]);
            if (check.rows.length === 0) throw new Error('Proses tidak ditemukan');
        }
        if (saleId) {
            const check = await query('SELECT id FROM trx.sales WHERE id = $1', [saleId]);
            if (check.rows.length === 0) throw new Error('Nota penjualan tidak ditemukan');
        }

        // Note: r2_key column name in DB is kept as r2_key, but it now stores the Supabase fileKey
        const result = await query(
            `INSERT INTO trx.files (purchase_id, process_id, sale_id, sale_type, file_type, r2_key, original_name, mime_type, size_bytes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
            [purchaseId || null, processId || null, saleId || null, saleType || null, fileType, r2Key, originalName, mimeType, sizeBytes, createdBy || null]
        );
        return result.rows[0];
    }

    // Get files by purchase ID
    async getFilesByPurchase(purchaseId) {
        const result = await query(
            `SELECT * FROM trx.files WHERE purchase_id = $1 ORDER BY created_at DESC`,
            [purchaseId]
        );

        // Add signed URLs to each file
        const filesWithUrls = await Promise.all(
            result.rows.map(async (file) => {
                try {
                    const url = this.isConfigured ? await this.getSignedUrl(file.r2_key) : null;
                    return { ...file, url };
                } catch {
                    return { ...file, url: null };
                }
            })
        );

        return filesWithUrls;
    }

    // Get files by process ID
    async getFilesByProcess(processId) {
        const result = await query(
            `SELECT * FROM trx.files WHERE process_id = $1 ORDER BY created_at DESC`,
            [processId]
        );

        const filesWithUrls = await Promise.all(
            result.rows.map(async (file) => {
                try {
                    const url = this.isConfigured ? await this.getSignedUrl(file.r2_key) : null;
                    return { ...file, url };
                } catch {
                    return { ...file, url: null };
                }
            })
        );

        return filesWithUrls;
    }

    // Get files by sale
    async getFilesBySale(saleType, saleId) {
        const result = await query(
            `SELECT * FROM trx.files WHERE sale_type = $1 AND sale_id = $2 ORDER BY created_at DESC`,
            [saleType, saleId]
        );

        const filesWithUrls = await Promise.all(
            result.rows.map(async (file) => {
                try {
                    const url = this.isConfigured ? await this.getSignedUrl(file.r2_key) : null;
                    return { ...file, url };
                } catch {
                    return { ...file, url: null };
                }
            })
        );

        return filesWithUrls;
    }

    // Delete file (from Supabase and database)
    async deleteFile(fileId) {
        // Get file metadata first
        const result = await query(`SELECT * FROM trx.files WHERE id = $1`, [fileId]);

        if (result.rows.length === 0) {
            throw new Error('File not found');
        }

        const file = result.rows[0];

        // Delete from Storage
        if (this.isConfigured) {
            await this.deleteFromStorage(file.r2_key);
        }

        // Delete from database
        await query(`DELETE FROM trx.files WHERE id = $1`, [fileId]);

        return file;
    }

    // Get file by ID
    async getFileById(fileId) {
        const result = await query(`SELECT * FROM trx.files WHERE id = $1`, [fileId]);

        if (result.rows.length === 0) {
            return null;
        }

        const file = result.rows[0];

        try {
            const url = this.isConfigured ? await this.getSignedUrl(file.r2_key) : null;
            return { ...file, url };
        } catch {
            return { ...file, url: null };
        }
    }
}

module.exports = new FileService();

