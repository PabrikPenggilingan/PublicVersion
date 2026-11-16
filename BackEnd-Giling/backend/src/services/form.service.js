const db = require('../config/database');
const logger = require('./logger.service');
const purchaseService = require('./purchase.service');
const logisticsModel = require('../models/logistics.model');

class FormService {
    async getFormInfo(linkCode) {
        const linkResult = await db.query(
            `SELECT bl.*, b.batch_date, b.status as batch_status,
                    (SELECT COUNT(*) FROM trx.purchases WHERE batch_id = b.id) as purchase_count,
                    (SELECT COALESCE(SUM(berat_gabah_kg), 0) FROM trx.purchases WHERE batch_id = b.id) as total_tonnage
             FROM trx.batch_links bl
             JOIN trx.batches b ON bl.batch_id = b.id
             WHERE bl.link_code = $1`,
            [linkCode]
        );

        if (linkResult.rows.length === 0) {
            const error = new Error('Link not found');
            error.statusCode = 404;
            throw error;
        }

        const link = linkResult.rows[0];

        if (!link.is_active) {
            const error = new Error('Link is not active');
            error.statusCode = 403;
            throw error;
        }

        if (link.expires_at && new Date(link.expires_at) < new Date()) {
            const error = new Error('Link has expired');
            error.statusCode = 403;
            throw error;
        }

        if (link.form_type === 'PURCHASE' && link.batch_status !== 'OPEN') {
            const error = new Error('Batch is closed');
            error.statusCode = 403;
            throw error;
        }

        const completionResult = await db.query(
            'SELECT id FROM trx.batch_completions WHERE batch_id = $1',
            [link.batch_id]
        );

        return {
            linkCode: link.link_code,
            formType: link.form_type,
            batchId: link.batch_id,
            batchDate: link.batch_date,
            batchStatus: link.batch_status,
            purchaseCount: parseInt(link.purchase_count),
            totalTonnage: parseFloat(link.total_tonnage) || 0,
            maxPurchases: 8,
            isCompleted: completionResult.rows.length > 0
        };
    }

    async submitPurchase(command) {
        const linkResult = await db.query(
            `SELECT bl.*, b.status as batch_status, b.jenis_gabah,
                    (SELECT COUNT(*) FROM trx.purchases WHERE batch_id = b.id) as purchase_count,
                    (SELECT COALESCE(SUM(berat_gabah_kg), 0) FROM trx.purchases WHERE batch_id = b.id) as total_tonnage
             FROM trx.batch_links bl
             JOIN trx.batches b ON bl.batch_id = b.id
             WHERE bl.link_code = $1 AND bl.is_active = true`,
            [command.linkCode]
        );

        if (linkResult.rows.length === 0) {
            const error = new Error('Invalid or inactive link');
            error.statusCode = 404;
            throw error;
        }

        const link = linkResult.rows[0];

        if (link.batch_status !== 'OPEN') {
            const error = new Error('Batch is closed');
            error.statusCode = 403;
            throw error;
        }

        const completionResult = await db.query(
            'SELECT id FROM trx.batch_completions WHERE batch_id = $1',
            [link.batch_id]
        );
        if (completionResult.rows.length > 0) {
            const error = new Error('Batch sudah di-complete, data tidak bisa ditambah/diubah');
            error.statusCode = 403;
            throw error;
        }

        if (parseInt(link.purchase_count) >= 8) {
            const error = new Error('Maximum purchases reached');
            error.statusCode = 403;
            throw error;
        }

        command.jenisGabah = link.jenis_gabah || 'IR64';

        if (!command.hargaPerKg || !command.beratGabahKg || !command.kualitasGabah) {
            const error = new Error('Missing required fields');
            error.statusCode = 400;
            throw error;
        }

        const parsedHargaPerKg = Math.min(parseFloat(command.hargaPerKg) || 0, 99999999.99);
        const parsedBeratGabahKg = Math.min(parseFloat(command.beratGabahKg) || 0, 99999999.99);
        const parsedKadarAir = command.kadarAir ? Math.min(parseFloat(command.kadarAir) || 0, 100) : null;
        const parsedKadarHampa = command.kadarHampa ? Math.min(parseFloat(command.kadarHampa) || 0, 100) : null;

        if (parsedHargaPerKg <= 0 || parsedBeratGabahKg <= 0) {
            const error = new Error('Harga dan berat harus lebih dari 0');
            error.statusCode = 400;
            throw error;
        }

        const userResult = await db.query('SELECT username FROM sys.users WHERE id = $1', [command.userId]);
        const username = userResult.rows[0]?.username || 'Unknown';

        const totalHarga = parsedHargaPerKg * parsedBeratGabahKg;

        // Harga sampai tempat: amount actually paid to the seller (incl. transport).
        // Empty = same as the goods value. The difference becomes the suggested batch transport cost.
        let totalDibayar = null;
        if (command.totalDibayar !== undefined && command.totalDibayar !== null && command.totalDibayar !== '') {
            totalDibayar = Math.min(parseFloat(command.totalDibayar), 999999999999.99);
            if (isNaN(totalDibayar) || totalDibayar < 0) {
                const error = new Error('Total dibayar tidak valid');
                error.statusCode = 400;
                throw error;
            }
        }

        const purchaseResult = await db.query(
            `INSERT INTO trx.purchases (
                batch_id, nama, tanggal_belanja, calo, lokasi_belanja, koordinat,
                harga_per_kg, total_harga, berat_gabah_kg, kualitas_gabah, filled_by, total_dibayar
            ) VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *`,
            [
                link.batch_id,
                username,
                command.calo,
                command.lokasiBelanja,
                command.koordinat || null,
                parsedHargaPerKg,
                totalHarga,
                parsedBeratGabahKg,
                command.kualitasGabah,
                command.userId,
                totalDibayar
            ]
        );

        const purchase = purchaseResult.rows[0];

        await db.query(
            `INSERT INTO trx.pendataan_gabah (
                purchase_id, created_by, jenis_gabah, varietas, kadar_air, kadar_hampa, kondisi_gabah
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                purchase.id,
                command.userId,
                command.jenisGabah,
                command.jenisGabah,
                parsedKadarAir,
                parsedKadarHampa,
                command.kondisiGabah || 'kering'
            ]
        );

        // Buat Jurnal Pembelian di General Ledger
        try {
            const financeModel = require('../models/finance.model');
            const invId = await financeModel.getRequiredAccountId('1-300');
            const apId = await financeModel.getRequiredAccountId('2-100');

            await financeModel.createJournalEntry({
                referenceType: 'PURCHASE',
                referenceId: purchase.id,
                description: `Pembelian Gabah: ${command.calo || username} (${command.jenisGabah || 'Gabah'})`,
                status: 'APPROVED',
                createdBy: command.userId,
                lines: [
                    { accountId: invId, debit: Number(totalHarga), credit: 0 },
                    { accountId: apId, debit: 0, credit: Number(totalHarga) }
                ]
            });
        } catch (journalErr) {
            console.error('[FormService] Gagal buat jurnal pembelian:', journalErr.message);
        }

        for (const file of command.files) {
            await db.query(
                `INSERT INTO trx.purchase_photos (purchase_id, file_path, file_name, file_size)
                 VALUES ($1, $2, $3, $4)`,
                [purchase.id, file.path, file.originalname, file.size]
            );
        }

        // Removed logistics creation from here, handled in completeBatch

        await logger.log({
            userId: command.userId,
            action: 'CREATE',
            entityType: 'purchase',
            entityId: purchase.id,
            oldData: null,
            newData: purchase,
            ipAddress: null, // Controllers handle IP and UA
            userAgent: null
        });

        const countResult = await db.query(
            `SELECT COUNT(*) as count, COALESCE(SUM(berat_gabah_kg), 0) as total_tonnage 
             FROM trx.purchases WHERE batch_id = $1`,
            [link.batch_id]
        );

        return {
            purchase,
            photoCount: command.files.length,
            purchaseCount: parseInt(countResult.rows[0].count),
            totalTonnage: parseFloat(countResult.rows[0].total_tonnage),
            maxPurchases: 8
        };
    }

    async getBatchSummary(linkCode, userId) {
        const linkResult = await db.query(
            `SELECT bl.batch_id, b.batch_date, b.status as batch_status, b.created_by as batch_created_by
             FROM trx.batch_links bl
             JOIN trx.batches b ON bl.batch_id = b.id
             WHERE bl.link_code = $1`,
            [linkCode]
        );

        if (linkResult.rows.length === 0) {
            const error = new Error('Link not found');
            error.statusCode = 404;
            throw error;
        }

        const batchId = linkResult.rows[0].batch_id;

        const purchasesResult = await db.query(
            `SELECT p.*, 
                    pg.jenis_gabah, pg.kadar_air, pg.kadar_hampa, pg.kondisi_gabah, pg.varietas,
                    (SELECT COUNT(*) FROM trx.purchase_photos WHERE purchase_id = p.id) as photo_count,
                    (SELECT json_agg(json_build_object('id', pp.id, 'file_path', pp.file_path, 'file_name', pp.file_name))
                     FROM trx.purchase_photos pp WHERE pp.purchase_id = p.id) as photos
             FROM trx.purchases p
             LEFT JOIN trx.pendataan_gabah pg ON p.id = pg.purchase_id
             WHERE p.batch_id = $1
             ORDER BY p.created_at DESC`,
            [batchId]
        );

        const totalsResult = await db.query(
            `SELECT COUNT(*) as total_entries, 
                    COALESCE(SUM(berat_gabah_kg), 0) as total_tonnage,
                    COALESCE(SUM(total_harga), 0) as total_nilai_gabah,
                    COALESCE(SUM(COALESCE(total_dibayar, total_harga)), 0) as total_dibayar,
                    (SELECT COUNT(*) FROM trx.purchase_photos pp 
                     JOIN trx.purchases p ON pp.purchase_id = p.id 
                     WHERE p.batch_id = $1) as total_photos
             FROM trx.purchases WHERE batch_id = $1`,
            [batchId]
        );

        const completionResult = await db.query(
            'SELECT * FROM trx.batch_completions WHERE batch_id = $1',
            [batchId]
        );

        return {
            batchId,
            batchDate: linkResult.rows[0].batch_date,
            batchStatus: linkResult.rows[0].batch_status,
            canViewBatch: this.canViewBatch(linkResult.rows[0].batch_created_by, userId),
            entries: purchasesResult.rows,
            totalEntries: parseInt(totalsResult.rows[0].total_entries),
            totalTonnage: parseFloat(totalsResult.rows[0].total_tonnage),
            totalPhotos: parseInt(totalsResult.rows[0].total_photos),
            // Harga sampai tempat: goods value vs amount actually paid → suggested transport cost
            totalNilaiGabah: parseFloat(totalsResult.rows[0].total_nilai_gabah) || 0,
            totalDibayar: parseFloat(totalsResult.rows[0].total_dibayar) || 0,
            suggestedTransportCost: Math.max(0, (parseFloat(totalsResult.rows[0].total_dibayar) || 0) - (parseFloat(totalsResult.rows[0].total_nilai_gabah) || 0)),
            maxPurchases: 8,
            completion: completionResult.rows[0] || null
        };
    }

    async completeBatch(command) {


        const linkResult = await db.query(
            `SELECT bl.batch_id
             FROM trx.batch_links bl
             WHERE bl.link_code = $1 AND bl.is_active = true`,
            [command.linkCode]
        );

        if (linkResult.rows.length === 0) {
            const error = new Error('Link not found');
            error.statusCode = 404;
            throw error;
        }

        const batchId = linkResult.rows[0].batch_id;

        const existingCompletion = await db.query(
            'SELECT id FROM trx.batch_completions WHERE batch_id = $1',
            [batchId]
        );

        if (existingCompletion.rows.length > 0) {
            const error = new Error('Batch sudah di-complete sebelumnya');
            error.statusCode = 400;
            throw error;
        }

        const totalsResult = await db.query(
            `SELECT COUNT(*) as total_entries, COALESCE(SUM(berat_gabah_kg), 0) as total_tonnage
             FROM trx.purchases WHERE batch_id = $1`,
            [batchId]
        );

        if (parseInt(totalsResult.rows[0].total_entries) < 1) {
            const error = new Error('Minimal 1 entry diperlukan sebelum complete');
            error.statusCode = 400;
            throw error;
        }

        const strukPath = command.files?.struk?.length > 0 ? command.files.struk[0].path : null;
        if (!strukPath) {
            const error = new Error('Foto struk/kwitansi wajib diupload');
            error.statusCode = 400;
            throw error;
        }
        const lapanganPath = command.files?.lapangan?.length > 0 ? command.files.lapangan[0].path : null;

        const completionResult = await db.query(
            `INSERT INTO trx.batch_completions (batch_id, struk_photo_path, lapangan_photo_path, total_tonnage, total_entries, completed_by)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [
                batchId,
                strukPath,
                lapanganPath,
                parseFloat(totalsResult.rows[0].total_tonnage),
                parseInt(totalsResult.rows[0].total_entries),
                command.userId
            ]
        );

        // Process logistics if operationalCost is provided
        if (command.operationalCost || command.durationHours || command.driverName || command.origin) {
            // Find the first purchase ID to link the logistics task
            const firstPurchaseResult = await db.query(
                'SELECT id FROM trx.purchases WHERE batch_id = $1 ORDER BY created_at ASC LIMIT 1',
                [batchId]
            );

            if (firstPurchaseResult.rows.length > 0) {
                const firstPurchaseId = firstPurchaseResult.rows[0].id;
                
                const financeModel = require('../models/finance.model');
                const expRes = await db.query(`SELECT id FROM trx.finance_accounts WHERE account_code = '5-200' LIMIT 1`);
                const expId = expRes.rows[0]?.id;
                
                let financeTransactionId = null;
                
                if (expId && command.operationalCost && parseFloat(command.operationalCost) > 0) {
                    const financeTx = await financeModel.createJournalEntry({
                        referenceType: 'LOGISTICS',
                        referenceId: firstPurchaseId,
                        description: `Biaya Logistik: ${command.driverName || 'Sopir'} (via Form Belanja Batch)`,
                        status: 'PENDING',
                        createdBy: command.userId,
                        lines: [
                            { accountId: expId, debit: Number(command.operationalCost), credit: 0 },
                            { accountId: null, debit: 0, credit: Number(command.operationalCost) }
                        ]
                    });
                    financeTransactionId = financeTx.id;
                }

                await logisticsModel.create({
                    referenceType: 'PURCHASE',
                    referenceId: firstPurchaseId,
                    driverName: command.driverName || '',
                    crewNames: command.crewNames || '',
                    origin: command.origin || '',
                    destination: command.destination || '',
                    durationHours: command.durationHours ? parseFloat(command.durationHours) : null,
                    operationalCost: parseFloat(command.operationalCost) || 0,
                    financeTransactionId,
                    status: 'PENDING',
                    notes: 'Created via Form Belanja Gabah Phase 2 (Batch Completion)',
                    createdBy: command.userId
                });
            }
        }

        await logger.log({
            userId: command.userId,
            action: 'COMPLETE',
            entityType: 'batch',
            entityId: batchId,
            oldData: null,
            newData: completionResult.rows[0],
            ipAddress: null,
            userAgent: null
        });

        return completionResult.rows[0];
    }

    async getMySubmissions(userId, page, limit) {
        const offset = (page - 1) * limit;

        const result = await db.query(
            `SELECT p.*, b.batch_date,
                    (SELECT COUNT(*) FROM trx.purchase_photos WHERE purchase_id = p.id) as photo_count
             FROM trx.purchases p
             JOIN trx.batches b ON p.batch_id = b.id
             WHERE p.filled_by = $1
             ORDER BY p.created_at DESC
             LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );

        const countResult = await db.query(
            'SELECT COUNT(*) as total FROM trx.purchases WHERE filled_by = $1',
            [userId]
        );

        return {
            data: result.rows,
            total: parseInt(countResult.rows[0].total)
        };
    }

    // Strict multi-tenancy: only the batch owner (tenant) can open Batch Detail after completing the form
    canViewBatch(batchCreatedBy, userId) {
        return !!userId && !!batchCreatedBy && batchCreatedBy === userId;
    }

    async getBatchIdFromLink(linkCode) {
        const linkResult = await db.query(
            `SELECT bl.batch_id
             FROM trx.batch_links bl
             JOIN trx.batches b ON bl.batch_id = b.id
             WHERE bl.link_code = $1 AND bl.is_active = true`,
            [linkCode]
        );

        if (linkResult.rows.length === 0) {
            const error = new Error('Invalid or inactive link');
            error.statusCode = 404;
            throw error;
        }
        return linkResult.rows[0].batch_id;
    }

    async ensureBatchNotCompleted(batchId) {
        const completionResult = await db.query(
            'SELECT id FROM trx.batch_completions WHERE batch_id = $1',
            [batchId]
        );
        if (completionResult.rows.length > 0) {
            const error = new Error('Batch sudah di-complete, data tidak bisa ditambah/diubah');
            error.statusCode = 403;
            throw error;
        }
    }

    async ensurePurchaseBelongsToBatch(purchaseId, batchId) {
        const verifyPurchase = await db.query('SELECT batch_id FROM trx.purchases WHERE id = $1', [purchaseId]);
        if (verifyPurchase.rows.length === 0 || verifyPurchase.rows[0].batch_id !== batchId) {
            const error = new Error('Purchase not found in this batch');
            error.statusCode = 404;
            throw error;
        }
    }
}

module.exports = new FormService();
